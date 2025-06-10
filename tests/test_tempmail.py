import pytest
from playwright.sync_api import Page, expect
import re

@pytest.fixture(autouse=True)
def before_each(page: Page):
    page.goto("http://localhost:8000")
    # Wait for core elements to load
    page.wait_for_selector(".app-container")

def test_homepage_loads(page: Page):
    """Test that the homepage loads with core elements"""
    # Check title
    expect(page).to_have_title("TempMail Pro - Professional Temporary Email Service | Disposable Email Generator")
    
    # Verify core elements
    expect(page.locator(".logo-text")).to_have_text("TempMail Pro")
    expect(page.locator("#aboutBanner")).to_be_visible()
    expect(page.locator(".sidebar")).to_be_visible()
    expect(page.locator(".main-content")).to_be_visible()

def test_email_generation_form(page: Page):
    """Test email generation form functionality"""
    # Check form elements
    form = page.locator(".generator-form")
    expect(form).to_be_visible()
    
    # Verify form fields
    expect(page.locator("#customUsername")).to_be_visible()
    expect(page.locator("#domainSelect")).to_be_visible()
    expect(page.locator("#customPassword")).to_be_visible()
    expect(page.locator("#generateBtn")).to_be_visible()

def test_theme_switching(page: Page):
    """Test theme switching functionality"""
    # Get theme selector
    theme_selector = page.locator("#themeSelector")
    
    # Test light theme
    theme_selector.select_option("light")
    expect(page.locator("body")).to_have_attribute("data-theme", "light")
    
    # Test dark theme
    theme_selector.select_option("dark")
    expect(page.locator("body")).to_have_attribute("data-theme", "dark")
    
    # Test blue theme
    theme_selector.select_option("blue")
    expect(page.locator("body")).to_have_attribute("data-theme", "blue")

def test_quick_email_generation(page: Page):
    """Test quick email generation"""
    # Click quick new button
    page.click("#quickNewBtn")
    
    # Wait for mailbox creation
    page.wait_for_selector(".mailbox-card")
    
    # Verify mailbox was created
    mailbox = page.locator(".mailbox-card").first
    expect(mailbox).to_be_visible()
    
    # Verify email format
    email_text = mailbox.locator(".mailbox-email").text_content()
    assert re.match(r".+@.+\..+", email_text), "Invalid email format"

def test_custom_email_generation(page: Page):
    """Test custom email generation"""
    # Fill custom email form
    page.fill("#customUsername", "testuser")
    page.locator("#domainSelect").select_option(index=1)  # Select first available domain
    page.fill("#customPassword", "TestPass123!")
    
    # Submit form
    page.click("#generateBtn")
    
    # Wait for mailbox creation
    page.wait_for_selector(".mailbox-card")
    
    # Verify mailbox was created with custom username
    mailbox = page.locator(".mailbox-card").first
    email_text = mailbox.locator(".mailbox-email").text_content()
    assert email_text.startswith("testuser@"), "Custom username not used"

def test_mailbox_actions(page: Page):
    """Test mailbox actions (copy, share, delete)"""
    # Create a mailbox first
    page.click("#quickNewBtn")
    page.wait_for_selector(".mailbox-card")
    
    # Test copy button
    copy_btn = page.locator(".action-btn.copy").first
    expect(copy_btn).to_be_visible()
    
    # Test share button
    share_btn = page.locator(".action-btn.share").first
    share_btn.click()
    expect(page.locator(".modal")).to_be_visible()
    
    # Close share modal
    page.click(".modal-close")
    
    # Test delete button
    delete_btn = page.locator(".action-btn.delete").first
    page.on("dialog", lambda dialog: dialog.accept())  # Handle confirmation dialog
    delete_btn.click()
    expect(page.locator(".mailbox-card")).to_have_count(0)

def test_notification_system(page: Page):
    """Test notification system"""
    # Create mailbox to trigger notification
    page.click("#quickNewBtn")
    
    # Verify notification appears
    notification = page.locator(".notification")
    expect(notification).to_be_visible()
    expect(notification).to_have_class(re.compile("success"))

def test_responsive_layout(page: Page):
    """Test responsive layout behavior"""
    # Test mobile viewport
    page.set_viewport_size({"width": 375, "height": 667})
    expect(page.locator(".app-container")).to_have_css("flex-direction", "column")
    
    # Test tablet viewport
    page.set_viewport_size({"width": 768, "height": 1024})
    expect(page.locator(".app-container")).to_have_css("flex-direction", "row")
    
    # Reset viewport
    page.set_viewport_size({"width": 1280, "height": 800})

def test_settings_page(page: Page):
    """Test settings page functionality"""
    # Navigate to settings
    page.click("text=Settings")
    
    # Verify settings elements
    expect(page.locator("#settingsTheme")).to_be_visible()
    expect(page.locator("#refreshInterval")).to_be_visible()
    expect(page.locator("#notificationSound")).to_be_visible()

def test_about_modal(page: Page):
    """Test about modal"""
    # Open about modal
    page.click("text=About")
    
    # Verify modal content
    modal = page.locator("#aboutModal")
    expect(modal).to_be_visible()
    expect(modal.locator(".modal-title")).to_contain_text("About TempMail Pro")
    
    # Close modal
    page.click(".modal-close")
    expect(modal).to_be_hidden()