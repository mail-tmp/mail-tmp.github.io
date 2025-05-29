# 📧 TempMail - Modern Disposable Email for Developers

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Built with: JavaScript](https://img.shields.io/badge/Built_with-JavaScript-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Framework: TailwindCSS](https://img.shields.io/badge/Framework-TailwindCSS-06B6D4.svg)](https://tailwindcss.com)
[![API: mail.tm](https://img.shields.io/badge/API-mail.tm-green.svg)](https://docs.mail.tm)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

Your ultimate developer companion for email testing. TempMail provides instant, secure disposable email addresses powered by the robust mail.tm API. Perfect for development, testing, and protecting your primary inbox.

## ⚡️ Core Features

- 🔒 **Zero-Trust Security**
  - Client-side storage for complete privacy
  - No server-side data retention
  - Secure mail.tm API integration

- 💻 **Developer-First Design**
  - API testing ready
  - Multiple mailbox support
  - Real-time email monitoring
  - Keyboard shortcuts
  - Auto-refresh capability

- 🎯 **Practical Innovation**
  - One-click email generation
  - Instant copy functionality
  - Clean, modern dark interface
  - Mobile-responsive design

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **UI Framework**: TailwindCSS + FontAwesome
- **Email Backend**: mail.tm API
- **Storage**: Browser LocalStorage
- **Tooling**: Bootstrap (modals & tooltips)

## 🔥 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/tempmail.git

# Navigate to project
cd tempmail

# Start local server (e.g., using Python)
python -m http.server 8000

# Or using Node.js
npx serve
```

Visit `http://localhost:8000` in your browser.

## 🚀 Usage Examples

### Basic Email Generation
```javascript
// Get a new disposable email
await tempMail.generateEmail();

// Copy to clipboard
tempMail.copyEmail();
```

### Mailbox Management
```javascript
// Check for new emails
await tempMail.checkEmails();

// Enable auto-refresh
tempMail.toggleAutoRefresh();

// Clear all emails
tempMail.clearAllEmails();
```

## 🔐 Security Features

- **Zero Data Persistence**
  - All data stored locally
  - No server-side tracking
  - Session-based authentication

- **Privacy Protection**
  - No personal data collection
  - Temporary email addresses
  - Automatic cleanup

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [mail.tm](https://mail.tm) for their robust API
- [TailwindCSS](https://tailwindcss.com) for the elegant styling system
- [FontAwesome](https://fontawesome.com) for the beautiful icons

---

<p align="center">Built with ❤️ for developers who value clean code and privacy</p>