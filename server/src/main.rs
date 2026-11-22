use clap::Parser;
use std::fs;
use std::io::{self, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tiny_http::{Header, Response, Server, StatusCode};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
pub struct Cli {
    /// Port to listen on
    #[arg(short, long, default_value_t = 3000, env = "PORT")]
    pub port: u16,

    /// Directory containing static files to serve
    #[arg(short, long, default_value = "./build", env = "STATIC_DIR")]
    pub dir: PathBuf,

    /// Run in healthcheck probe mode: exits 0 if healthy, non-zero otherwise
    #[arg(long)]
    pub healthcheck: bool,
}

pub fn guess_mime(path: &Path) -> &'static str {
    match path.extension().and_then(|ext| ext.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "application/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

pub fn percent_decode(input: &str) -> Option<String> {
    let mut bytes = Vec::with_capacity(input.len());
    let mut chars = input.bytes();
    while let Some(b) = chars.next() {
        if b == b'%' {
            let h1 = chars.next()?;
            let h2 = chars.next()?;
            let hex_bytes = [h1, h2];
            let hex_str = std::str::from_utf8(&hex_bytes).ok()?;
            let val = u8::from_str_radix(hex_str, 16).ok()?;
            bytes.push(val);
        } else {
            bytes.push(b);
        }
    }
    String::from_utf8(bytes).ok()
}

pub fn compute_cache_control(file_path: &Path, is_fallback: bool) -> &'static str {
    if is_fallback || file_path.file_name().and_then(|n| n.to_str()) == Some("index.html") {
        "no-cache, no-store, must-revalidate"
    } else {
        let path_str = file_path.to_str().unwrap_or("");
        let normalized = path_str.replace('\\', "/");
        if normalized.contains("/_app/immutable/") || normalized.contains("_app/immutable/") {
            "public, max-age=31536000, immutable"
        } else {
            "public, max-age=3600"
        }
    }
}

pub fn add_security_headers<R: Read>(res: &mut Response<R>) {
    res.add_header(
        Header::from_bytes(
            &b"Content-Security-Policy"[..],
            &b"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' http://localhost:* https://localhost:* ws: wss:; frame-ancestors 'none';"[..],
        ).unwrap(),
    );
    res.add_header(Header::from_bytes(&b"X-Frame-Options"[..], &b"DENY"[..]).unwrap());
    res.add_header(Header::from_bytes(&b"X-Content-Type-Options"[..], &b"nosniff"[..]).unwrap());
    res.add_header(Header::from_bytes(&b"Referrer-Policy"[..], &b"strict-origin-when-cross-origin"[..]).unwrap());
    res.add_header(
        Header::from_bytes(
            &b"Permissions-Policy"[..],
            &b"accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"[..],
        ).unwrap(),
    );
}

pub fn respond_with(
    request: tiny_http::Request,
    status: StatusCode,
    body: Vec<u8>,
    content_type: &str,
    cache_control: &str,
    encoding: Option<&str>,
    allow_header: Option<&str>,
    is_head: bool,
) {
    let body_len = body.len();
    if is_head {
        let mut res = Response::empty(status);
        res.add_header(Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap());
        res.add_header(Header::from_bytes(&b"Cache-Control"[..], cache_control.as_bytes()).unwrap());
        res.add_header(Header::from_bytes(&b"Content-Length"[..], format!("{}", body_len).as_bytes()).unwrap());
        if let Some(enc) = encoding {
            res.add_header(Header::from_bytes(&b"Content-Encoding"[..], enc.as_bytes()).unwrap());
        }
        if let Some(allow) = allow_header {
            res.add_header(Header::from_bytes(&b"Allow"[..], allow.as_bytes()).unwrap());
        }
        add_security_headers(&mut res);
        let _ = request.respond(res);
    } else {
        let mut res = Response::from_data(body).with_status_code(status);
        res.add_header(Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap());
        res.add_header(Header::from_bytes(&b"Cache-Control"[..], cache_control.as_bytes()).unwrap());
        if let Some(enc) = encoding {
            res.add_header(Header::from_bytes(&b"Content-Encoding"[..], enc.as_bytes()).unwrap());
        }
        if let Some(allow) = allow_header {
            res.add_header(Header::from_bytes(&b"Allow"[..], allow.as_bytes()).unwrap());
        }
        add_security_headers(&mut res);
        let _ = request.respond(res);
    }
}

pub fn load_file_content(
    file_path: &Path,
    accepts_encoding: &str,
) -> io::Result<(Vec<u8>, Option<&'static str>)> {
    let br_path = PathBuf::from(format!("{}.br", file_path.display()));
    let gz_path = PathBuf::from(format!("{}.gz", file_path.display()));

    if accepts_encoding.contains("br") && br_path.is_file() {
        if let Ok(bytes) = fs::read(&br_path) {
            return Ok((bytes, Some("br")));
        }
    }

    if (accepts_encoding.contains("gzip") || accepts_encoding.contains("gz")) && gz_path.is_file() {
        if let Ok(bytes) = fs::read(&gz_path) {
            return Ok((bytes, Some("gzip")));
        }
    }

    let bytes = fs::read(file_path)?;
    Ok((bytes, None))
}

pub fn resolve_file_path(base_dir: &Path, request_url: &str) -> Option<(PathBuf, bool)> {
    // 1. Strip query string (?) and URL fragments (#)
    let clean_url = request_url
        .split('?')
        .next()
        .unwrap_or("/")
        .split('#')
        .next()
        .unwrap_or("/");

    // 2. Decode percent-encoding
    let decoded = percent_decode(clean_url)?;

    // 3. Reject paths containing '..' or backslashes or drive letters/prefixes
    if decoded.contains("..") || decoded.contains('\\') || decoded.contains(':') {
        return None;
    }

    // 4. Normalize backslashes (if any) and trim leading slashes
    let normalized = decoded.replace('\\', "/");
    let trimmed = normalized.trim_start_matches('/');

    // 5. Check components for traversal or forbidden components
    for component in trimmed.split('/') {
        if component == ".." || component == "." || component.contains(':') || component.contains('\\') {
            return None;
        }
    }

    let canonical_base = base_dir.canonicalize().ok()?;

    let (target, is_fallback) = if trimmed.is_empty() {
        (canonical_base.join("index.html"), false)
    } else {
        let candidate = canonical_base.join(trimmed);
        if candidate.is_file() {
            (candidate, false)
        } else {
            let index_in_dir = candidate.join("index.html");
            if index_in_dir.is_file() {
                (index_in_dir, false)
            } else {
                (canonical_base.join("index.html"), true)
            }
        }
    };

    if !target.is_file() {
        return None;
    }

    // 6. Ensure target canonical path is within canonical_base
    let canonical_target = target.canonicalize().ok()?;
    if !canonical_target.starts_with(&canonical_base) {
        return None;
    }

    Some((canonical_target, is_fallback))
}

pub fn run_healthcheck(port: u16) -> Result<(), io::Error> {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let timeout = Duration::from_secs(2);
    let mut stream = TcpStream::connect_timeout(&addr, timeout)?;
    stream.set_read_timeout(Some(timeout))?;
    stream.set_write_timeout(Some(timeout))?;
    Write::write_all(
        &mut stream,
        b"GET /healthz HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n",
    )?;
    let mut response = Vec::new();
    stream.read_to_end(&mut response)?;
    let response_str = String::from_utf8_lossy(&response);
    if response_str.starts_with("HTTP/1.1 200") {
        Ok(())
    } else {
        Err(io::Error::new(io::ErrorKind::Other, "Healthcheck non-200"))
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    if cli.healthcheck {
        match run_healthcheck(cli.port) {
            Ok(_) => {
                println!("OK");
                std::process::exit(0);
            }
            Err(e) => {
                eprintln!("Healthcheck failed: {}", e);
                std::process::exit(1);
            }
        }
    }

    let bind_addr = format!("0.0.0.0:{}", cli.port);
    let server = match Server::http(&bind_addr) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to bind server to {}: {}", bind_addr, e);
            std::process::exit(1);
        }
    };

    println!(
        "Ferrous Frontend static asset server listening on http://{} (dir: {})",
        bind_addr,
        cli.dir.display()
    );

    for request in server.incoming_requests() {
        let method = request.method().clone();

        // Enforce method restriction: GET and HEAD only
        if method != tiny_http::Method::Get && method != tiny_http::Method::Head {
            respond_with(
                request,
                StatusCode(405),
                b"405 Method Not Allowed".to_vec(),
                "text/plain; charset=utf-8",
                "no-cache, no-store, must-revalidate",
                None,
                Some("GET, HEAD"),
                false,
            );
            continue;
        }

        let is_head = method == tiny_http::Method::Head;
        let raw_url = request.url();
        let clean_url = raw_url.split('?').next().unwrap_or("/").split('#').next().unwrap_or("/");

        // 1. Healthcheck endpoint
        if clean_url == "/healthz" || clean_url == "/healthz/" {
            let body = b"{\"status\":\"healthy\",\"service\":\"ferrous-frontend\"}".to_vec();
            respond_with(
                request,
                StatusCode(200),
                body,
                "application/json",
                "no-cache, no-store, must-revalidate",
                None,
                None,
                is_head,
            );
            continue;
        }

        // 2. Resolve file from disk with SPA fallback
        let maybe_file = resolve_file_path(&cli.dir, raw_url);
        match maybe_file {
            Some((file_path, is_fallback)) => {
                let accepts_encoding = request
                    .headers()
                    .iter()
                    .find(|h| h.field.equiv("Accept-Encoding"))
                    .map(|h| h.value.as_str())
                    .unwrap_or("");

                match load_file_content(&file_path, accepts_encoding) {
                    Ok((body_bytes, encoding_header)) => {
                        let mime = guess_mime(&file_path);
                        let cache_control = compute_cache_control(&file_path, is_fallback);

                        respond_with(
                            request,
                            StatusCode(200),
                            body_bytes,
                            mime,
                            cache_control,
                            encoding_header,
                            None,
                            is_head,
                        );
                    }
                    Err(_) => {
                        respond_with(
                            request,
                            StatusCode(500),
                            b"500 Internal Server Error".to_vec(),
                            "text/plain; charset=utf-8",
                            "no-cache, no-store, must-revalidate",
                            None,
                            None,
                            is_head,
                        );
                    }
                }
            }
            None => {
                respond_with(
                    request,
                    StatusCode(404),
                    b"404 Not Found".to_vec(),
                    "text/plain; charset=utf-8",
                    "no-cache, no-store, must-revalidate",
                    None,
                    None,
                    is_head,
                );
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    #[test]
    fn test_mime_guessing() {
        assert_eq!(guess_mime(Path::new("index.html")), "text/html; charset=utf-8");
        assert_eq!(guess_mime(Path::new("app.js")), "application/javascript; charset=utf-8");
        assert_eq!(guess_mime(Path::new("module.mjs")), "application/javascript; charset=utf-8");
        assert_eq!(guess_mime(Path::new("style.css")), "text/css; charset=utf-8");
        assert_eq!(guess_mime(Path::new("data.json")), "application/json; charset=utf-8");
        assert_eq!(guess_mime(Path::new("logo.svg")), "image/svg+xml");
        assert_eq!(guess_mime(Path::new("image.png")), "image/png");
        assert_eq!(guess_mime(Path::new("photo.jpg")), "image/jpeg");
        assert_eq!(guess_mime(Path::new("photo.jpeg")), "image/jpeg");
        assert_eq!(guess_mime(Path::new("photo.webp")), "image/webp");
        assert_eq!(guess_mime(Path::new("favicon.ico")), "image/x-icon");
        assert_eq!(guess_mime(Path::new("font.woff")), "font/woff");
        assert_eq!(guess_mime(Path::new("font.woff2")), "font/woff2");
        assert_eq!(guess_mime(Path::new("module.wasm")), "application/wasm");
        assert_eq!(guess_mime(Path::new("unknown.xyz")), "application/octet-stream");
    }

    #[test]
    fn test_percent_decoding() {
        assert_eq!(percent_decode("/hello%20world"), Some("/hello world".to_string()));
        assert_eq!(percent_decode("/%2e%2e/etc"), Some("/../etc".to_string()));
        assert_eq!(percent_decode("/%2E%2E/etc"), Some("/../etc".to_string()));
        assert_eq!(percent_decode("/%2f"), Some("//".to_string()));
        assert_eq!(percent_decode("/%5c"), Some("/\\".to_string()));
        assert_eq!(percent_decode("/normal/path"), Some("/normal/path".to_string()));
        assert_eq!(percent_decode("/invalid%2"), None);
        assert_eq!(percent_decode("/invalid%zz"), None);
    }

    #[test]
    fn test_cache_control_computation() {
        assert_eq!(
            compute_cache_control(Path::new("index.html"), false),
            "no-cache, no-store, must-revalidate"
        );
        assert_eq!(
            compute_cache_control(Path::new("app.js"), true),
            "no-cache, no-store, must-revalidate"
        );
        assert_eq!(
            compute_cache_control(Path::new("build/_app/immutable/chunks/app.js"), false),
            "public, max-age=31536000, immutable"
        );
        assert_eq!(
            compute_cache_control(Path::new("build/favicon.ico"), false),
            "public, max-age=3600"
        );
    }

    #[test]
    fn test_directory_traversal_prevention() {
        let base = PathBuf::from("/nonexistent");
        assert_eq!(resolve_file_path(&base, "/../etc/passwd"), None);
        assert_eq!(resolve_file_path(&base, "/app/../../secret"), None);
        assert_eq!(resolve_file_path(&base, "/%2e%2e/etc/passwd"), None);
        assert_eq!(resolve_file_path(&base, "/%2E%2E/etc/passwd"), None);
        assert_eq!(resolve_file_path(&base, "/%2e%2e%2fsecret"), None);
        assert_eq!(resolve_file_path(&base, "/..\\secret"), None);
        assert_eq!(resolve_file_path(&base, "/%2e%2e%5csecret"), None);
        assert_eq!(resolve_file_path(&base, "/C:/windows/win.ini"), None);
        assert_eq!(resolve_file_path(&base, "\\secret"), None);
        assert_eq!(resolve_file_path(&base, "/%5csecret"), None);
        assert_eq!(resolve_file_path(&base, "/test\\path"), None);
    }

    #[test]
    fn test_symlink_escape_prevention() {
        let temp_base = std::env::temp_dir().join("ferrous_symlink_test");
        let safe_dir = temp_base.join("safe");
        let outside_dir = temp_base.join("outside");

        let _ = fs::remove_dir_all(&temp_base);
        fs::create_dir_all(&safe_dir).unwrap();
        fs::create_dir_all(&outside_dir).unwrap();

        let secret_file = outside_dir.join("secret.txt");
        let mut f = File::create(&secret_file).unwrap();
        writeln!(f, "TOP SECRET DATA").unwrap();

        let link_path = safe_dir.join("secret_link.txt");

        #[cfg(unix)]
        let symlink_created = std::os::unix::fs::symlink(&secret_file, &link_path).is_ok();

        #[cfg(windows)]
        let symlink_created = std::os::windows::fs::symlink_file(&secret_file, &link_path).is_ok();

        if symlink_created {
            assert_eq!(resolve_file_path(&safe_dir, "/secret_link.txt"), None);
        }

        let _ = fs::remove_dir_all(&temp_base);
    }

    #[test]
    fn test_spa_fallback_resolution() {
        let temp_dir = std::env::temp_dir().join("ferrous_test_spa");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();
        let index_file = temp_dir.join("index.html");
        let mut f = File::create(&index_file).unwrap();
        writeln!(f, "<html><body>SPA Root</body></html>").unwrap();

        // Direct index
        let resolved_root = resolve_file_path(&temp_dir, "/");
        assert!(resolved_root.is_some());
        let (path, is_fallback) = resolved_root.unwrap();
        assert_eq!(path.file_name(), index_file.file_name());
        assert!(!is_fallback);

        // Client-side SPA route with query and fragment
        let resolved_spa = resolve_file_path(&temp_dir, "/investigation?foo=bar#section");
        assert!(resolved_spa.is_some());
        let (path, is_fallback) = resolved_spa.unwrap();
        assert_eq!(path.file_name(), index_file.file_name());
        assert!(is_fallback);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_compression_fallback() {
        let temp_dir = std::env::temp_dir().join("ferrous_test_compression");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let asset_file = temp_dir.join("bundle.js");
        let gz_file = temp_dir.join("bundle.js.gz");
        let br_file = temp_dir.join("bundle.js.br");

        fs::write(&asset_file, b"uncompressed bundle").unwrap();
        fs::write(&gz_file, b"gzip bundle").unwrap();
        fs::write(&br_file, b"brotli bundle").unwrap();

        // Accepts both br and gzip -> prefers br
        let (bytes, enc) = load_file_content(&asset_file, "gzip, deflate, br").unwrap();
        assert_eq!(bytes, b"brotli bundle");
        assert_eq!(enc, Some("br"));

        // Accepts gzip only -> serves gzip
        let (bytes, enc) = load_file_content(&asset_file, "gzip, deflate").unwrap();
        assert_eq!(bytes, b"gzip bundle");
        assert_eq!(enc, Some("gzip"));

        // Accepts neither -> serves uncompressed
        let (bytes, enc) = load_file_content(&asset_file, "").unwrap();
        assert_eq!(bytes, b"uncompressed bundle");
        assert_eq!(enc, None);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_security_headers() {
        let mut res = Response::empty(StatusCode(200));
        add_security_headers(&mut res);
        let headers: Vec<String> = res.headers().iter().map(|h| format!("{}: {}", h.field, h.value)).collect();
        assert!(headers.iter().any(|h| h.starts_with("Content-Security-Policy:")));
        assert!(headers.iter().any(|h| h == "X-Frame-Options: DENY"));
        assert!(headers.iter().any(|h| h == "X-Content-Type-Options: nosniff"));
        assert!(headers.iter().any(|h| h == "Referrer-Policy: strict-origin-when-cross-origin"));
        assert!(headers.iter().any(|h| h.starts_with("Permissions-Policy:")));
    }

    #[test]
    fn test_healthcheck_closed_port() {
        // Bind to port 0 to get an ephemeral port, then close it
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);

        let result = run_healthcheck(port);
        assert!(result.is_err(), "Healthcheck on closed port must fail");
    }

    #[test]
    fn test_healthcheck_mock_200() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();

        let handle = thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                let mut buf = [0u8; 512];
                let _ = stream.read(&mut buf);
                let _ = stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK");
            }
        });

        let result = run_healthcheck(port);
        assert!(result.is_ok(), "Healthcheck with 200 OK must succeed");
        let _ = handle.join();
    }

    #[test]
    fn test_healthcheck_mock_503() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();

        let handle = thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                let mut buf = [0u8; 512];
                let _ = stream.read(&mut buf);
                let _ = stream.write_all(b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\n\r\n");
            }
        });

        let result = run_healthcheck(port);
        assert!(result.is_err(), "Healthcheck with 503 must fail");
        let _ = handle.join();
    }
}
