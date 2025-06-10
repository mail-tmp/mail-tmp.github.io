import pytest
import os
import subprocess
import time
from typing import Dict
from playwright.sync_api import sync_playwright

def pytest_configure(config):
    """Create test directories and start HTTP server"""
    if not os.path.exists('test-results'):
        os.makedirs('test-results')
    if not os.path.exists('test-reports'):
        os.makedirs('test-reports')
    
    # Start Python HTTP server
    server_process = subprocess.Popen(
        ['python', '-m', 'http.server', '8000'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    # Wait for server to start
    time.sleep(2)
    
    # Store server process to be terminated later
    pytest.server_process = server_process

def pytest_unconfigure(config):
    """Cleanup: Stop HTTP server"""
    if hasattr(pytest, 'server_process'):
        pytest.server_process.terminate()
        pytest.server_process.wait()

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args: Dict):
    return {
        **browser_context_args,
        "viewport": {
            "width": 1280,
            "height": 800,
        },
    }

@pytest.fixture(scope="session")
def browser_type_launch_args(browser_type_launch_args):
    return {
        **browser_type_launch_args,
        "headless": True,
    }