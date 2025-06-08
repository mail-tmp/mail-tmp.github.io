
#!/usr/bin/env python3
"""
TempMail Pro - Comprehensive UI Testing Suite
Fast Python-based testing with Chromium
"""

import os
import sys
import time
import json
import logging
from pathlib import Path
from datetime import datetime
from playwright.sync_api import sync_playwright, expect
from bs4 import BeautifulSoup

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TempMailUITester:
    def __init__(self):
        self.test_results = []
        self.screenshots_dir = Path("screenshots")
        self.test_results_dir = Path("test-results")
        self.screenshots_dir.mkdir(exist_ok=True)
        self.test_results_dir.mkdir(exist_ok=True)
        
    def setup_browser(self, playwright):
        """Setup optimized Chromium browser"""
        browser = playwright.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--memory-pressure-off',
                '--max_old_space_size=4096'
            ]
        )
        
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        page = context.new_page()
        
        # Enhanced error tracking
        page.on('pageerror', lambda error: logger.error(f"Page error: {error}"))
        page.on('console', lambda msg: logger.info(f"Console {msg.type}: {msg.text}"))
        
        return browser, context, page
    
    def load_page(self, page):
        """Load the TempMail Pro page"""
        file_path = Path.cwd() / "index.html"
        page.goto(f"file://{file_path}")
        page.wait_for_load_state('networkidle', timeout=10000)
        return page
    
    def run_test(self, test_name, test_func, page):
        """Run individual test with error handling"""
        start_time = time.time()
        try:
            logger.info(f"Running test: {test_name}")
            test_func(page)
            duration = time.time() - start_time
            self.test_results.append({
                'name': test_name,
                'status': 'PASSED',
                'duration': duration,
                'error': None
            })
            logger.info(f"✅ {test_name} - PASSED ({duration:.2f}s)")
            return True
        except Exception as e:
            duration = time.time() - start_time
            # Take screenshot on failure
            screenshot_path = self.screenshots_dir / f"{test_name.replace(' ', '_')}_failure.png"
            page.screenshot(path=str(screenshot_path))
            
            self.test_results.append({
                'name': test_name,
                'status': 'FAILED',
                'duration': duration,
                'error': str(e)
            })
            logger.error(f"❌ {test_name} - FAILED ({duration:.2f}s): {e}")
            return False
    
    def test_page_loads(self, page):
        """Test page loads successfully"""
        expect(page).to_have_title(/TempMail Pro/)
        expect(page.locator('.logo-text')).to_contain_text('TempMail Pro')
        expect(page.locator('.sidebar')).to_be_visible()
        expect(page.locator('.main-content')).to_be_visible()
    
    def test_no_javascript_errors(self, page):
        """Test for JavaScript errors on page load"""
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.reload()
        page.wait_for_load_state('networkidle')
        
        # Check for specific fixed errors
        error_text = ' '.join(errors)
        assert "Cannot read properties of undefined (reading 'target')" not in error_text
        assert "unsafe.replace is not a function" not in error_text
        assert len([e for e in errors if 'TypeError' in e]) == 0
    
    def test_email_generator_visible(self, page):
        """Test email generator is always visible"""
        generator_panel = page.locator('#generatorPanel')
        expect(generator_panel).to_be_visible()
        
        # Test form elements
        expect(page.locator('#customUsername')).to_be_visible()
        expect(page.locator('#domainSelect')).to_be_visible()
        expect(page.locator('#customPassword')).to_be_visible()
        expect(page.locator('.generate-btn')).to_be_visible()
    
    def test_domain_loading(self, page):
        """Test domains are loaded"""
        domain_select = page.locator('#domainSelect')
        page.wait_for_function("document.querySelector('#domainSelect').options.length > 1")
        options_count = domain_select.locator('option').count()
        assert options_count > 1, "Domains should be loaded"
    
    def test_email_generation(self, page):
        """Test email generation functionality"""
        # Clear any existing mailboxes
        page.evaluate("window.mailboxes = []; window.saveMailboxes(); window.updateInboxView();")
        
        # Fill form and generate email
        page.fill('#customUsername', 'testuser')
        page.select_option('#domainSelect', index=1)
        page.fill('#customPassword', 'TestPass123!')
        
        page.click('.generate-btn')
        page.wait_for_timeout(2000)
        
        # Check if mailbox was created
        mailboxes = page.evaluate("window.mailboxes.length")
        assert mailboxes > 0, "Email should be generated"
        
        # Check email content
        email_text = page.locator('.mailbox-email').first.text_content()
        assert 'testuser' in email_text, "Custom username should be in email"
    
    def test_theme_switching(self, page):
        """Test theme switching functionality"""
        theme_selector = page.locator('#themeSelector')
        body = page.locator('body')
        
        # Test light theme
        theme_selector.select_option('light')
        expect(body).to_have_attribute('data-theme', 'light')
        
        # Test blue theme
        theme_selector.select_option('blue')
        expect(body).to_have_attribute('data-theme', 'blue')
        
        # Test dark theme
        theme_selector.select_option('dark')
        expect(body).to_have_attribute('data-theme', 'dark')
    
    def test_password_strength(self, page):
        """Test password strength validation"""
        password_input = page.locator('#customPassword')
        strength_div = page.locator('#passwordStrength')
        
        # Test weak password
        password_input.fill('123')
        page.evaluate("checkPasswordStrength()")
        expect(strength_div).to_contain_text('Weak')
        
        # Test strong password
        password_input.fill('MyStrongP@ssw0rd!')
        page.evaluate("checkPasswordStrength()")
        expect(strength_div).to_contain_text('Strong')
    
    def test_password_visibility_toggle(self, page):
        """Test password visibility toggle"""
        password_input = page.locator('#customPassword')
        toggle_btn = page.locator('.password-toggle')
        
        password_input.fill('testpassword')
        
        # Initially should be password type
        expect(password_input).to_have_attribute('type', 'password')
        
        # Click toggle
        toggle_btn.click()
        expect(password_input).to_have_attribute('type', 'text')
        
        # Click toggle again
        toggle_btn.click()
        expect(password_input).to_have_attribute('type', 'password')
    
    def test_copy_functionality(self, page):
        """Test copy to clipboard functionality"""
        # Generate an email first
        page.evaluate("window.mailboxes = []; window.saveMailboxes();")
        page.select_option('#domainSelect', index=1)
        page.click('.generate-btn')
        page.wait_for_timeout(1000)
        
        # Test copy functionality
        page.click('.action-btn.copy')
        
        # Check for success notification
        expect(page.locator('.notification')).to_be_visible()
        expect(page.locator('.notification-message')).to_contain_text('copied to clipboard')
    
    def test_modal_functionality(self, page):
        """Test about modal functionality"""
        # Open about modal
        page.click('button:has-text("About")')
        expect(page.locator('#aboutModal')).to_have_class(/show/)
        expect(page.locator('.modal-title')).to_contain_text('About TempMail Pro')
        
        # Close modal with X button
        page.click('.modal-close')
        expect(page.locator('#aboutModal')).not_to_have_class(/show/)
        
        # Test ESC key
        page.click('button:has-text("About")')
        expect(page.locator('#aboutModal')).to_have_class(/show/)
        page.keyboard.press('Escape')
        expect(page.locator('#aboutModal')).not_to_have_class(/show/)
    
    def test_responsive_design(self, page):
        """Test responsive design"""
        # Mobile view
        page.set_viewport_size({'width': 375, 'height': 667})
        expect(page.locator('.sidebar')).to_be_visible()
        expect(page.locator('.main-content')).to_be_visible()
        
        # Desktop view
        page.set_viewport_size({'width': 1280, 'height': 720})
        expect(page.locator('.sidebar')).to_be_visible()
        expect(page.locator('.main-content')).to_be_visible()
    
    def test_form_validation(self, page):
        """Test form validation"""
        # Try to generate without selecting domain
        page.click('.generate-btn')
        
        # Should show error notification
        expect(page.locator('.notification.error')).to_be_visible()
        expect(page.locator('.notification-message')).to_contain_text('Please select a domain')
    
    def test_local_storage_persistence(self, page):
        """Test local storage persistence"""
        # Generate an email
        page.evaluate("window.mailboxes = []; window.saveMailboxes();")
        page.select_option('#domainSelect', index=1)
        page.click('.generate-btn')
        page.wait_for_timeout(1000)
        
        # Reload page
        page.reload()
        page.wait_for_load_state('networkidle')
        
        # Check if mailbox is still there
        mailboxes_count = page.evaluate("window.mailboxes.length")
        assert mailboxes_count > 0, "Mailboxes should persist after reload"
    
    def test_xss_prevention(self, page):
        """Test XSS prevention"""
        # Test XSS in email display
        page.evaluate("""
            if (window.mailboxes.length === 0) {
                window.mailboxes.push({
                    id: 'test-mailbox',
                    email: 'test@example.com',
                    emails: [],
                    unreadCount: 0
                });
            }
            
            const xssEmail = {
                id: 'xss-test',
                from: '<script>alert("XSS")</script>',
                subject: '<img src=x onerror=alert("XSS")>',
                textBody: '<script>document.body.innerHTML = "HACKED"</script>',
                date: new Date().toISOString(),
                read: false
            };
            
            window.mailboxes[0].emails = [xssEmail];
            window.currentMailbox = window.mailboxes[0];
            window.updateInboxView();
        """)
        
        # Check that script tags are escaped
        email_from = page.locator('.email-from').text_content()
        assert '<script>' not in email_from
        assert '&lt;script&gt;' in email_from
        
        # Verify page is not compromised
        expect(page.locator('body')).not_to_contain_text('HACKED')
    
    def generate_report(self):
        """Generate comprehensive test report"""
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t['status'] == 'PASSED'])
        failed_tests = total_tests - passed_tests
        total_duration = sum(t['duration'] for t in self.test_results)
        
        # Generate HTML report
        html_report = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>TempMail Pro - Test Results</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; }}
                .header {{ background: linear-gradient(135deg, #f26207, #56d8ff); color: white; padding: 20px; border-radius: 8px; }}
                .summary {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }}
                .stat-card {{ background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }}
                .stat-card.success {{ border-left: 4px solid #28a745; }}
                .stat-card.failure {{ border-left: 4px solid #dc3545; }}
                .test-item {{ padding: 10px; margin: 5px 0; border-radius: 4px; }}
                .test-item.passed {{ background: #d4edda; border-left: 4px solid #28a745; }}
                .test-item.failed {{ background: #f8d7da; border-left: 4px solid #dc3545; }}
                .stat-number {{ font-size: 2em; font-weight: bold; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📧 TempMail Pro - Test Results</h1>
                <p>Fast Python + Chromium Testing Suite</p>
                <p>Generated: {datetime.now().isoformat()}</p>
            </div>
            
            <div class="summary">
                <div class="stat-card success">
                    <div class="stat-number">{passed_tests}</div>
                    <div>Tests Passed</div>
                </div>
                <div class="stat-card failure">
                    <div class="stat-number">{failed_tests}</div>
                    <div>Tests Failed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{total_tests}</div>
                    <div>Total Tests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{total_duration:.1f}s</div>
                    <div>Total Duration</div>
                </div>
            </div>
            
            <h2>Test Details</h2>
        """
        
        for test in self.test_results:
            status_class = 'passed' if test['status'] == 'PASSED' else 'failed'
            error_info = f"<br><small>Error: {test['error']}</small>" if test['error'] else ""
            html_report += f"""
            <div class="test-item {status_class}">
                <strong>{test['name']}</strong> - {test['status']} ({test['duration']:.2f}s)
                {error_info}
            </div>
            """
        
        html_report += """
            </body>
            </html>
        """
        
        # Save HTML report
        with open(self.test_results_dir / 'report.html', 'w') as f:
            f.write(html_report)
        
        # Save JSON results
        with open(self.test_results_dir / 'results.json', 'w') as f:
            json.dump({
                'summary': {
                    'total': total_tests,
                    'passed': passed_tests,
                    'failed': failed_tests,
                    'duration': total_duration,
                    'timestamp': datetime.now().isoformat()
                },
                'tests': self.test_results
            }, f, indent=2)
        
        return passed_tests, failed_tests, total_duration

def main():
    """Main test execution"""
    logger.info("🚀 Starting TempMail Pro UI Tests")
    
    tester = TempMailUITester()
    
    # Define test suite
    test_suite = [
        ('Page Loads Successfully', tester.test_page_loads),
        ('No JavaScript Errors', tester.test_no_javascript_errors),
        ('Email Generator Visible', tester.test_email_generator_visible),
        ('Domain Loading', tester.test_domain_loading),
        ('Email Generation', tester.test_email_generation),
        ('Theme Switching', tester.test_theme_switching),
        ('Password Strength', tester.test_password_strength),
        ('Password Visibility Toggle', tester.test_password_visibility_toggle),
        ('Copy Functionality', tester.test_copy_functionality),
        ('Modal Functionality', tester.test_modal_functionality),
        ('Responsive Design', tester.test_responsive_design),
        ('Form Validation', tester.test_form_validation),
        ('Local Storage Persistence', tester.test_local_storage_persistence),
        ('XSS Prevention', tester.test_xss_prevention)
    ]
    
    with sync_playwright() as playwright:
        browser, context, page = tester.setup_browser(playwright)
        
        try:
            # Load page once
            tester.load_page(page)
            
            # Run all tests
            for test_name, test_func in test_suite:
                tester.run_test(test_name, test_func, page)
                # Reset page state between tests
                page.evaluate("window.mailboxes = []; window.currentMailbox = null; window.saveMailboxes(); window.updateInboxView();")
            
        finally:
            browser.close()
    
    # Generate report
    passed, failed, duration = tester.generate_report()
    
    logger.info(f"🏁 Testing completed in {duration:.1f}s")
    logger.info(f"✅ Passed: {passed}")
    logger.info(f"❌ Failed: {failed}")
    
    if failed > 0:
        logger.error(f"Tests failed! Check test-results/report.html for details")
        sys.exit(1)
    else:
        logger.info("🎉 All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()
