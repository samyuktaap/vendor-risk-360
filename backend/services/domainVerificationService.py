import socket
import urllib.request
import urllib.error
import re
import logging

logger = logging.getLogger(__name__)

def verify_vendor_existence(domain: str) -> dict:
    """
    Multi-probe verification to check if a vendor domain actually exists on the internet before onboarding.
    Checks:
    1. Domain Format & Syntax
    2. Public DNS A/AAAA record resolution
    3. Live HTTP/HTTPS socket connectivity
    """
    domain_clean = domain.lower().replace("https://", "").replace("http://", "").strip("/")
    
    # 1. Syntax Validation
    domain_regex = r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
    if not re.match(domain_regex, domain_clean):
        return {
            "is_valid": False,
            "error_code": "INVALID_SYNTAX",
            "message": f"Invalid domain format: '{domain}'. Must be a valid domain e.g. company.com"
        }

    # 2. Public DNS Resolution Probe
    dns_resolved = False
    resolved_ip = None
    try:
        resolved_ip = socket.gethostbyname(domain_clean)
        dns_resolved = True
    except socket.gaierror:
        # Retry with www.
        try:
            resolved_ip = socket.gethostbyname(f"www.{domain_clean}")
            dns_resolved = True
        except socket.gaierror:
            dns_resolved = False

    if not dns_resolved:
        return {
            "is_valid": False,
            "error_code": "DNS_NOT_FOUND",
            "message": f"Domain verification failed: '{domain_clean}' does not exist or has no registered public DNS records."
        }

    # 3. HTTP / HTTPS Connection Probe
    web_active = False
    http_code = None
    protocols = [f"https://{domain_clean}", f"http://{domain_clean}"]
    
    for url in protocols:
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "VendorRisk360-DomainVerifier/1.0"}
            )
            with urllib.request.urlopen(req, timeout=4) as response:
                http_code = response.getcode()
                if http_code in [200, 301, 302, 307, 308, 401, 403]:
                    web_active = True
                    break
        except urllib.error.HTTPError as e:
            # 401/403/405 means the server exists and answered
            web_active = True
            http_code = e.code
            break
        except Exception:
            continue

    if not web_active:
        logger.warning(f"Domain {domain_clean} resolved to {resolved_ip} but web probe timed out.")

    return {
        "is_valid": True,
        "domain": domain_clean,
        "resolved_ip": resolved_ip,
        "dns_resolved": dns_resolved,
        "web_active": web_active,
        "http_code": http_code,
        "message": f"Domain '{domain_clean}' verified (IP: {resolved_ip})"
    }
