// Google Analytics Setup
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'GA_MEASUREMENT_ID');

class TempMail {
    constructor() {
        this.currentEmail = '';
        this.currentToken = '';
        this.emails = [];
        this.refreshInterval = null;
        this.apiBase = 'https://api.mail.tm';
        this.savedMailboxes = {};
        this.autoRefreshEnabled = false;

        this.loadSavedData();
        this.updateMailboxSelector();
        this.initializeTooltips();
        this.initializeAboutBanner();

        const lastUsed = this.getLastUsedMailbox();
        if (lastUsed && this.savedMailboxes[lastUsed]) {
            this.loadMailbox(lastUsed);
        } else {
            this.generateEmail();
        }
    }

    initializeTooltips() {
        try {
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            tooltipTriggerList.forEach(triggerEl => {
                if (!bootstrap.Tooltip.getInstance(triggerEl)) {
                    new bootstrap.Tooltip(triggerEl);
                }
            });
        } catch (error) {
            console.error('Error initializing tooltips:', error);
        }
    }

    initializeAboutBanner() {
        const headerSection = document.getElementById('headerSection');
        const aboutBanner = document.getElementById('aboutBanner');
        let isVisible = false;
        
        if (!headerSection || !aboutBanner) return;

        const showBanner = () => {
            aboutBanner.classList.remove('hidden');
            // Force a reflow before adding the visible class
            aboutBanner.offsetHeight;
            aboutBanner.classList.add('visible');
            isVisible = true;
        };

        const hideBanner = () => {
            aboutBanner.classList.remove('visible');
            isVisible = false;
            // Wait for transition to complete before hiding
            setTimeout(() => {
                if (!isVisible) {
                    aboutBanner.classList.add('hidden');
                }
            }, 300);
        };

        headerSection.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (aboutBanner.classList.contains('visible')) {
                hideBanner();
            } else {
                showBanner();
            }
        });

        // Close banner when clicking outside
        document.addEventListener('click', (event) => {
            if (isVisible && !aboutBanner.contains(event.target) && !headerSection.contains(event.target)) {
                hideBanner();
            }
        });

        // Handle keyboard accessibility
        headerSection.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (aboutBanner.classList.contains('visible')) {
                    hideBanner();
                } else {
                    showBanner();
                }
            } else if (e.key === 'Escape' && isVisible) {
                hideBanner();
            }
        });
    }

    async generateEmail() {
        try {
            const btn = document.querySelector('button[onclick="generateEmail()"]');
            this.showStatus(btn, 'Generating email...', 'info');

            const domainsResponse = await fetch(`${this.apiBase}/domains`, { method: 'GET' });
            if (!domainsResponse.ok) {
                throw new Error(`Failed to get domains: ${domainsResponse.status}`);
            }
            const domains = await domainsResponse.json();

            if (!domains['hydra:member'] || !Array.isArray(domains['hydra:member']) || domains['hydra:member'].length === 0) {
                throw new Error('No domains available');
            }

            const domain = domains['hydra:member'][0].domain;
            const username = this.generateRandomString(8);
            this.currentEmail = `${username}@${domain}`;

            const createResponse = await fetch(`${this.apiBase}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: this.currentEmail,
                    password: 'temppassword123'
                })
            });

            if (!createResponse.ok) {
                const errorData = await createResponse.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to create account: ${createResponse.status}`);
            }

            const authResponse = await fetch(`${this.apiBase}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: this.currentEmail,
                    password: 'temppassword123'
                })
            });

            if (!authResponse.ok) {
                throw new Error(`Failed to get authentication token: ${authResponse.status}`);
            }

            const authData = await authResponse.json();
            if (!authData.token) {
                throw new Error('No token received');
            }
            this.currentToken = authData.token;

            this.emails = [];
            this.updateEmailDisplay();
            this.updateEmailList();

            document.getElementById('currentEmailSection').classList.remove('hidden');
            document.getElementById('emailDisplay').innerHTML = `<span>${this.currentEmail}</span>`;
            document.getElementById('emailList').classList.remove('hidden');

            this.showStatus(btn, 'Email generated!', 'success');

            this.saveMailbox();
            this.updateMailboxSelector();
            this.initializeTooltips();

            if (typeof trackEmailGeneration === 'function') {
                trackEmailGeneration();
            }

            this.startAutoRefresh();

        } catch (error) {
            const btn = document.querySelector('button[onclick="generateEmail()"]');
            this.showStatus(btn, 'Error generating email', 'danger');
            console.error('Generate email error:', error.message);
        }
    }

    generateRandomString(length) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async checkEmails() {
        if (!this.currentEmail || !this.currentToken) {
            const btn = document.getElementById('refreshBtn');
            this.showStatus(btn, 'Generate an email first', 'warning');
            return;
        }

        try {
            const btn = document.getElementById('refreshBtn');
            this.setRefreshButton(true);
            document.getElementById('refreshOverlay').classList.remove('hidden');

            if (typeof trackEmailCheck === 'function') {
                trackEmailCheck();
            }

            const response = await fetch(`${this.apiBase}/messages`, {
                headers: { 'Authorization': `Bearer ${this.currentToken}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch messages: ${response.status}`);
            }

            const data = await response.json();
            const messages = data['hydra:member'] || [];

            if (messages.length > 0) {
                const existingIds = new Set(this.emails.map(email => email.id));
                const newEmails = messages.filter(msg => msg.id && !existingIds.has(msg.id));

                if (newEmails.length > 0) {
                    this.emails = [...newEmails, ...this.emails];
                    this.showStatus(btn, `${newEmails.length} new email(s)!`, 'success');
                    this.updateEmailList();
                    this.saveMailbox();
                    this.updateMailboxSelector();
                } else {
                    this.showStatus(btn, 'No new emails', 'info');
                }
            } else {
                this.showStatus(btn, 'Inbox empty', 'info');
            }

        } catch (error) {
            const btn = document.getElementById('refreshBtn');
            this.showStatus(btn, 'Error checking emails', 'danger');
            console.error('Check emails error:', error.message);
        } finally {
            this.setRefreshButton(false);
            document.getElementById('refreshOverlay').classList.add('hidden');
            this.initializeTooltips();
        }
    }

    async getEmailContent(messageId) {
        try {
            if (!messageId) {
                throw new Error('No message ID provided');
            }

            const response = await fetch(`${this.apiBase}/messages/${messageId}`, {
                headers: { 'Authorization': `Bearer ${this.currentToken}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch message content: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Get email content error:', error.message);
            return null;
        }
    }

    showStatus(element, message, type = 'info') {
        const tooltip = bootstrap.Tooltip.getInstance(element);
        if (tooltip) {
            element.setAttribute('data-bs-original-title', message);
            tooltip.setContent({ '.tooltip-inner': message });
            tooltip.show();

            const tooltipElement = document.querySelector('.tooltip');
            if (tooltipElement) {
                tooltipElement.querySelector('.tooltip-inner').className = `tooltip-inner alert-${type}`;
            }

            setTimeout(() => tooltip.hide(), 3000);
        }
    }

    updateEmailList() {
        const emailsContainer = document.getElementById('emails');
        const emailCount = document.getElementById('emailCount');
        const emptyInbox = document.getElementById('emptyInbox');

        emailCount.textContent = this.emails.length;

        if (this.emails.length === 0) {
            emailsContainer.innerHTML = '';
            emptyInbox.classList.remove('hidden');
            return;
        }

        emptyInbox.classList.add('hidden');
        emailsContainer.innerHTML = this.emails.map((email, index) => `
            <div class="bg-gray-900 border border-gray-600 rounded-lg p-4 mb-2 hover:bg-gray-800 transition cursor-pointer" 
                 onclick="tempMail.showEmailDetails('${email.id}')">
                <div class="flex justify-between items-start mb-2">
                    <div class="font-semibold text-gray-100">${this.escapeHtml(email.from?.address || 'Unknown Sender')}</div>
                    <div class="text-sm text-gray-400">${this.formatDate(email.createdAt)}</div>
                </div>
                <div class="text-gray-300">${this.escapeHtml(email.subject || 'No Subject')}</div>
            </div>
        `).join('');
    }

    updateEmailDisplay() {
        const display = document.getElementById('emailDisplay');
        if (this.currentEmail) {
            display.innerHTML = `<span>${this.currentEmail}</span>`;
        } else {
            display.innerHTML = '<span>No email generated</span>';
        }
    }

    copyEmail() {
        if (this.currentEmail) {
            navigator.clipboard.writeText(this.currentEmail).then(() => {
                const btn = document.querySelector('button[onclick="copyEmail()"]');
                this.showStatus(btn, 'Email copied!', 'success');

                if (typeof trackEmailCopy === 'function') {
                    trackEmailCopy();
                }
            }).catch(err => {
                console.error('Copy failed:', err);
                const btn = document.querySelector('button[onclick="copyEmail()"]');
                this.showStatus(btn, 'Copy failed', 'danger');
            });
        }
    }

    toggleAutoRefresh() {
        this.autoRefreshEnabled = !this.autoRefreshEnabled;
        const btn = document.getElementById('autoRefreshBtn');
        
        if (this.autoRefreshEnabled) {
            this.startAutoRefresh();
            this.showStatus(btn, 'Auto-refresh enabled', 'success');
            btn.innerHTML = '<i class="fas fa-clock mr-2"></i>Auto-Refresh: ON';
        } else {
            this.stopAutoRefresh();
            this.showStatus(btn, 'Auto-refresh disabled', 'info');
            btn.innerHTML = '<i class="fas fa-clock mr-2"></i>Auto-Refresh: OFF';
        }
    }

    startAutoRefresh() {
        if (this.autoRefreshEnabled && !this.refreshInterval) {
            this.refreshInterval = setInterval(() => this.checkEmails(), 30000);
        }
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    setRefreshButton(loading) {
        const btn = document.getElementById('refreshBtn');
        btn.disabled = loading;
        btn.innerHTML = loading ? 
            '<div class="loading-spinner mr-2"></div>Refreshing...' : 
            '<i class="fas fa-sync-alt mr-2"></i>Refresh';
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleString();
        } catch (e) {
            return dateString || '';
        }
    }

    saveMailbox() {
        if (this.currentEmail && this.currentToken) {
            this.savedMailboxes[this.currentEmail] = {
                token: this.currentToken,
                emails: this.emails,
                lastUsed: new Date().toISOString()
            };
            localStorage.setItem('tempMailboxes', JSON.stringify(this.savedMailboxes));
            localStorage.setItem('lastUsedMailbox', this.currentEmail);
        }
    }

    loadSavedData() {
        try {
            const savedData = localStorage.getItem('tempMailboxes');
            if (savedData) {
                this.savedMailboxes = JSON.parse(savedData);
            }
        } catch (error) {
            console.error('Error loading saved data:', error);
            this.savedMailboxes = {};
        }
    }

    updateMailboxSelector() {
        const selector = document.getElementById('mailboxSelector');
        if (!selector) return;

        const currentOptions = Array.from(selector.options).map(opt => opt.value);
        const savedMailboxes = Object.keys(this.savedMailboxes);

        // Remove options that no longer exist
        currentOptions.forEach(opt => {
            if (opt && !savedMailboxes.includes(opt)) {
                selector.remove(selector.querySelector(`option[value="${opt}"]`).index);
            }
        });

        // Add new options
        savedMailboxes.forEach(email => {
            if (!currentOptions.includes(email)) {
                const option = document.createElement('option');
                option.value = email;
                option.textContent = email;
                selector.appendChild(option);
            }
        });

        // Update selected option
        if (this.currentEmail) {
            selector.value = this.currentEmail;
        }
    }

    switchMailbox() {
        const selector = document.getElementById('mailboxSelector');
        const selectedEmail = selector.value;

        if (selectedEmail && this.savedMailboxes[selectedEmail]) {
            this.loadMailbox(selectedEmail);
        }
    }

    loadMailbox(email) {
        if (!this.savedMailboxes[email]) return;

        const mailbox = this.savedMailboxes[email];
        this.currentEmail = email;
        this.currentToken = mailbox.token;
        this.emails = mailbox.emails || [];

        document.getElementById('currentEmailSection').classList.remove('hidden');
        document.getElementById('emailList').classList.remove('hidden');
        
        this.updateEmailDisplay();
        this.updateEmailList();
        this.updateMailboxSelector();

        localStorage.setItem('lastUsedMailbox', email);
    }

    getLastUsedMailbox() {
        return localStorage.getItem('lastUsedMailbox');
    }

    deleteMailbox() {
        if (this.currentEmail) {
            delete this.savedMailboxes[this.currentEmail];
            localStorage.setItem('tempMailboxes', JSON.stringify(this.savedMailboxes));

            if (this.currentEmail === localStorage.getItem('lastUsedMailbox')) {
                localStorage.removeItem('lastUsedMailbox');
            }

            this.currentEmail = '';
            this.currentToken = '';
            this.emails = [];

            document.getElementById('currentEmailSection').classList.add('hidden');
            document.getElementById('emailList').classList.add('hidden');
            this.updateMailboxSelector();
        }
    }

    clearAllEmails() {
        if (this.currentEmail && this.emails.length > 0) {
            this.emails = [];
            this.updateEmailList();
            this.saveMailbox();
            const btn = document.querySelector('button[onclick="clearAllEmails()"]');
            this.showStatus(btn, 'Inbox cleared', 'success');
        }
    }

    async showEmailDetails(messageId) {
        try {
            const emailData = await this.getEmailContent(messageId);
            if (!emailData) {
                throw new Error('Failed to fetch email content');
            }

            document.getElementById('modalFrom').textContent = emailData.from?.address || 'Unknown Sender';
            document.getElementById('modalSubject').textContent = emailData.subject || 'No Subject';
            document.getElementById('modalDate').textContent = this.formatDate(emailData.createdAt);

            const contentDiv = document.getElementById('modalContent');
            contentDiv.innerHTML = ''; // Clear existing content

            if (emailData.html) {
                const iframe = document.createElement('iframe');
                iframe.style.width = '100%';
                iframe.style.height = '400px';
                iframe.style.border = 'none';
                contentDiv.appendChild(iframe);

                iframe.contentDocument.open();
                iframe.contentDocument.write(emailData.html);
                iframe.contentDocument.close();
            } else {
                contentDiv.textContent = emailData.text || 'No content';
            }

            new bootstrap.Modal(document.getElementById('emailModal')).show();

        } catch (error) {
            console.error('Show email details error:', error.message);
            alert('Failed to load email content');
        }
    }
}

// Event listener for sidebar toggle
document.addEventListener('DOMContentLoaded', function() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('hidden');
        });
    }

    // Hide sidebar by default on small screens
    function checkScreenSize() {
        if (window.innerWidth < 1024 && sidebar) { // 1024px is the 'lg' breakpoint in Tailwind
            sidebar.classList.add('hidden');
        } else if (sidebar) {
            sidebar.classList.remove('hidden');
        }
    }

    // Run on load
    checkScreenSize();

    // Run on resize
    window.addEventListener('resize', checkScreenSize);
});

// Analytics Functions
function trackEmailGeneration() {
    gtag('event', 'email_generated', {
        'event_category': 'user_action',
        'event_label': 'new_temp_email'
    });
}

function trackEmailCheck() {
    gtag('event', 'check_emails', {
        'event_category': 'user_action',
        'event_label': 'check_inbox'
    });
}

function trackEmailCopy() {
    gtag('event', 'email_copied', {
        'event_category': 'user_action',
        'event_label': 'copy_to_clipboard'
    });
}

// Initialize TempMail instance
const tempMail = new TempMail();

// Global function declarations for HTML event handlers
window.generateEmail = () => tempMail.generateEmail();
window.checkEmails = () => tempMail.checkEmails();
window.copyEmail = () => tempMail.copyEmail();
window.toggleAutoRefresh = () => tempMail.toggleAutoRefresh();
window.switchMailbox = () => tempMail.switchMailbox();
window.deleteMailbox = () => tempMail.deleteMailbox();
window.clearAllEmails = () => tempMail.clearAllEmails();
