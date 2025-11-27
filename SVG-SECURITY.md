# SVG Security Scanner

> **Comprehensive security scanning for SVG files to detect malicious code, scripts, and security threats.**

This image converter now includes advanced SVG security scanning capabilities to protect against malicious SVG files that could contain JavaScript, external references, or other security threats.

---

## 🛡️ Features

### Automatic Security Scanning
- **All SVG files are automatically scanned** during conversion
- **Blocking threats prevent conversion** - malicious files are rejected
- **Non-blocking warnings are logged** - files with minor issues are converted with warnings
- **Detailed security reports** with threat analysis

### Multiple Security Levels
- **Permissive**: Minimal security - only blocks obvious threats
- **Moderate**: Balanced security (default) - blocks common threats while preserving functionality  
- **Strict**: Maximum security - blocks all potentially dangerous content

### Comprehensive Threat Detection
- ✅ **JavaScript execution** (scripts, event handlers, data URIs)
- ✅ **External references** (HTTP/HTTPS URLs, external stylesheets)
- ✅ **Foreign objects** (embedded HTML/iframes)
- ✅ **Event handlers** (onclick, onload, onmouseover, etc.)
- ✅ **XML entities** and processing instructions
- ✅ **Data URIs** with executable content
- ✅ **Animation elements** (in strict mode)
- ✅ **DOCTYPE declarations** and XML exploits

---

## 🚀 Usage

### 1. Automatic Scanning (CLI)

SVG files are automatically scanned during normal conversion:

```bash
# SVGs are scanned automatically during conversion
bun run imgco -f webp

# Malicious SVGs will be blocked:
# ❌ malicious.svg: SVG contains 5 security threat(s)

# Safe SVGs with warnings will be converted:
# ⚠️ safe.svg: 1 SVG security warning(s) 
# ✓ Saved: safe.webp
```

### 2. Dedicated Security Scanning (CLI)

Scan SVG files without converting them:

```bash
# Basic security scan
bun run imgco --scan-svg

# Strict security level
bun run imgco --scan-svg --strict

# Detailed reports
bun run imgco --scan-svg --detailed

# Permissive security level  
bun run imgco --scan-svg --permissive
```

### 3. Web Interface

Upload SVG files through the web interface:
- **Real-time client-side validation** shows warnings before upload
- **Server-side security scanning** with detailed threat analysis
- **Security badges** indicate file safety status
- **Detailed security warnings** for problematic files

### 4. API Endpoint

Direct API access for security scanning:

```bash
# Scan SVG file via API
curl -X POST http://localhost:3000/api/security/svg \
  -F "file=@suspicious.svg" \
  -F "securityLevel=moderate" \
  -F "sanitize=false"
```

**Response:**
```json
{
  "success": true,
  "security": {
    "safe": false,
    "level": "moderate", 
    "threatsFound": 8,
    "blockingThreats": 3,
    "threats": [
      {
        "type": "script",
        "severity": 10,
        "description": "JavaScript code detected in SVG",
        "blocking": true
      }
    ]
  },
  "report": "Full security report..."
}
```

---

## 🔍 Security Levels

### Permissive Mode
- **Use case**: Development, internal tools, trusted sources
- **Blocks**: Obvious malicious content (scripts, JavaScript)
- **Allows**: External references, data URIs, animations, foreign objects

### Moderate Mode (Default)
- **Use case**: General web applications, content management
- **Blocks**: Scripts, event handlers, foreign objects, external references, data URIs
- **Allows**: Animations, basic XML entities

### Strict Mode  
- **Use case**: High-security environments, public uploads, untrusted sources
- **Blocks**: All potentially dangerous content including animations
- **Allows**: Only basic SVG elements and safe attributes

---

## ⚠️ Threat Types & Severity

### Critical Threats (Severity 8-10) - Always Blocking
| Threat | Description | Example |
|--------|-------------|---------|
| `script` | JavaScript code execution | `<script>alert('XSS')</script>` |
| `event_handler` | HTML event handlers | `onclick="steal_data()"` |
| `foreign_object` | Embedded HTML content | `<foreignObject><iframe>` |

### Medium Threats (Severity 5-7) - Contextual Blocking
| Threat | Description | Blocked In |
|--------|-------------|------------|
| `external_reference` | HTTP/HTTPS URLs | Moderate, Strict |
| `data_uri` | Base64 encoded data | Moderate, Strict |
| `xml_entity` | XML entity declarations | Strict |

### Low Threats (Severity 1-4) - Warning Only  
| Threat | Description | Blocked In |
|--------|-------------|------------|
| `animation` | SVG animations | Strict |
| `doctype` | DOCTYPE declarations | None (warning) |
| `processing_instruction` | XML processing | Strict |

---

## 📊 Security Reports

### CLI Output
```
🔍 SVG Security Scanner

Security Level: MODERATE
Source: ./raw

Found 3 SVG file(s) to scan

Scanning: malicious.svg
  ❌ UNSAFE - 5 blocking threat(s)
    🚨 JavaScript code detected (Severity: 10/10)
    🚨 Event handler detected (Severity: 9/10)

Scanning: safe.svg  
  ✅ SAFE - No threats detected

📊 Scan Results:
  ✅ Safe: 1
  ⚠️  Warnings: 0
  ❌ Unsafe: 1
```

### Web Interface
- **🔴 Red badge**: Unsafe files with blocking threats
- **🟡 Yellow badge**: Safe files with warnings
- **🟢 Green badge**: Completely safe files
- **Detailed tooltips** with threat information
- **Security warnings** displayed prominently

---

## 🔧 Configuration

### Security Level Selection

**CLI:**
```bash
bun run imgco --scan-svg --strict     # Maximum security
bun run imgco --scan-svg --moderate   # Balanced (default)
bun run imgco --scan-svg --permissive # Minimal security
```

**API:**
```bash
curl -F "securityLevel=strict" ...
```

### File Size Limits
- **Maximum SVG size**: 5MB (configurable)
- **Minimum SVG size**: 100 bytes
- **Memory optimization**: Streaming analysis for large files

### Integration Points
- **File upload validation**: Automatic scanning during web uploads
- **CLI processing**: Pre-conversion security checks
- **API endpoints**: Direct security analysis
- **Batch processing**: Parallel scanning for multiple files

---

## 🎯 Example Threats Detected

### JavaScript Execution
```svg
<svg>
  <script>
    alert('XSS Attack!');
    fetch('/steal-data', { method: 'POST' });
  </script>
</svg>
```
**Status**: ❌ BLOCKED (Severity: 10/10)

### Event Handlers
```svg  
<rect onclick="document.location='http://malicious.com'" />
```
**Status**: ❌ BLOCKED (Severity: 9/10)

### External References
```svg
<image href="http://tracker.com/spy.png" />
<style>@import url('http://evil.com/steal.css')</style>
```
**Status**: ⚠️ WARNING (Moderate+) | ❌ BLOCKED (Strict)

### Foreign Objects
```svg
<foreignObject>
  <iframe src="http://malicious-site.com"></iframe>
</foreignObject>
```
**Status**: ❌ BLOCKED (Severity: 8/10)

### Data URIs with JavaScript
```svg
<image href="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KCdYU1MnKTwvc2NyaXB0Pjwvc3ZnPg==" />
```
**Status**: ❌ BLOCKED (Severity: 9/10)

---

## 🚨 Security Best Practices

### 1. **Choose Appropriate Security Level**
- Use **Strict** for public file uploads
- Use **Moderate** for general web applications  
- Use **Permissive** only for trusted internal tools

### 2. **Monitor Security Reports**
- Review security logs regularly
- Investigate files with multiple warnings
- Track blocked uploads for potential attack patterns

### 3. **File Source Validation**
- Treat user uploads as untrusted by default
- Scan files from external sources
- Consider additional validation for automated systems

### 4. **Defense in Depth**
- Combine SVG scanning with Content Security Policy (CSP)
- Use proper MIME type validation
- Implement file size and upload rate limits
- Consider sanitization for lower-risk use cases

---

## 📈 Performance

### Scanning Speed
- **Small files (<100KB)**: ~5-10ms per file
- **Medium files (100KB-1MB)**: ~20-50ms per file
- **Large files (1MB-5MB)**: ~100-300ms per file

### Memory Usage
- **Streaming analysis**: Minimal memory footprint
- **Parallel processing**: Configurable concurrency
- **Cache-friendly**: Results cached during processing

### Optimization Features
- **Early termination**: Stops on first critical threat
- **Pattern caching**: Reuses compiled regex patterns
- **Selective scanning**: Skip safe file signatures

---

## 🔄 Updates & Maintenance

### Threat Database Updates
The threat detection patterns are regularly updated to address:
- **New attack vectors**: Emerging SVG-based exploits
- **Browser vulnerabilities**: XSS and code execution risks  
- **Specification changes**: SVG and XML security updates

### Version Compatibility
- **SVG 1.1**: Full support with comprehensive scanning
- **SVG 2.0**: Enhanced detection for modern features
- **XML 1.0/1.1**: Complete XML security analysis

---

## ❓ FAQ

### Q: Will this break my existing SVG files?
**A:** Most legitimate SVG files will work fine. Only files with actual security threats (scripts, external references) may be blocked depending on your security level.

### Q: Can I disable SVG security scanning?
**A:** Security scanning is always enabled for SVG files. However, you can use "permissive" mode for minimal impact, or modify the source code if absolutely necessary.

### Q: What happens to blocked files?
**A:** Blocked files are not converted and detailed security reports are generated. No malicious code is executed during the scanning process.

### Q: Can the scanner sanitize malicious SVGs?
**A:** Basic sanitization is available via the API, but it's recommended to reject malicious files entirely rather than attempt to clean them.

### Q: Are there false positives?
**A:** The scanner is designed to minimize false positives while maintaining security. Files flagged as warnings (not blocked) likely contain legitimate but potentially risky content.

---

## 🔗 Related Documentation

- **[Main README](./README.md)** - General usage and setup
- **[API Documentation](./API.md)** - Complete API reference  
- **[Development Guide](./AGENTS.md)** - Technical architecture
- **[Security Policy](./SECURITY.md)** - Security practices and reporting

---

**🛡️ Stay secure! Always review SVG files from untrusted sources before using them in production.**