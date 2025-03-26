from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, StaleElementReferenceException
import time
import yaml
import os
from datetime import datetime

def count_characters(text):
    """Count characters in text"""
    if not text:
        return 0
    return len(str(text))

def estimate_tokens(text):
    """Estimate tokens based on character count (rough approximation)"""
    char_count = count_characters(text)
    # Using the 4 characters per token approximation
    return (char_count + 3) // 4

def setup_driver(headless=True):
    print("Setting up the WebDriver.")
    options = webdriver.ChromeOptions()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--start-maximized')
    options.add_argument('--headless')
 
    
    return webdriver.Chrome(options=options)

def get_page_content(driver, url):
    try:
        print(f"Navigating to URL: {url}")
        driver.get(url)
        
        # Wait for content to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "article.docs-content"))
        )
        
        print("Extracting main content from the page.")
        main_content = driver.find_element(By.CSS_SELECTOR, "article.docs-content")
        content_text = main_content.text
        
        print(f"Content extracted from {url}: {content_text[:100]}...")  # Print first 100 characters for debugging
        return content_text
    except Exception as e:
        print(f"Error on page {url}: {str(e)}")
        return ""

def save_to_yaml(data_item, filename="vitess_docs.yaml"):
    """Save the data to a YAML file in the specified format with proper pipe character for content"""
    try:
        # Load existing data if file exists, otherwise create new structure
        yaml_dict = {"vitess": []}
        
        if os.path.exists(filename):
            try:
                with open(filename, 'r', encoding='utf-8') as file:
                    file_content = file.read().strip()
                    if file_content and file_content != "vitess:":
                        yaml_dict = yaml.safe_load(file_content)
                    # If file just contains "vitess:" with no entries, we'll use our empty list
            except Exception as e:
                print(f"Error reading existing YAML file: {str(e)}, creating new file")
        
        # Determine the next ID
        next_id = 1
        if yaml_dict and "vitess" in yaml_dict and yaml_dict["vitess"]:
            # Get the highest ID and increment by 1
            existing_ids = [item.get("id_parent", 0) for item in yaml_dict["vitess"]]
            if existing_ids:
                next_id = max(existing_ids) + 1
        
        # Add ID to the data item
        data_item["id_parent"] = next_id
        
        # Add the new item to the list
        if "vitess" not in yaml_dict:
            yaml_dict["vitess"] = []
        yaml_dict["vitess"].append(data_item)
        
        # Create a properly formatted YAML file manually
        with open(filename, 'w', encoding='utf-8') as file:
            file.write("vitess:\n")
            
            for entry in yaml_dict["vitess"]:
                file.write(f"- id_parent: {entry['id_parent']}\n")
                file.write(f"  title: {entry['title']}\n")
                file.write(f"  url: {entry['url']}\n")
                file.write("  content: |\n")
                
                # Make sure content is a string and split by lines
                content_str = str(entry['content'])
                for line in content_str.split('\n'):
                    # Ensure each line has proper indentation
                    file.write(f"    {line}\n")
                
                file.write(f"  version_or_commonresource: {entry['version_or_commonresource']}\n")
                file.write(f"  char_count: {entry['char_count']}\n")
                file.write(f"  approx_token_count: {entry['approx_token_count']}\n")
        
        print(f"Data saved to {filename} with ID {next_id}")
        return next_id
    except Exception as e:
        print(f"Error saving to YAML: {str(e)}")
        return None

def scrape_docs_recursive(driver, base_url, start_url=None):
    """
    Scrape the documentation in a systematic way without hardcoding,
    optionally starting from a specific URL
    """
    processed_urls = set()  # Track processed URLs to avoid loops
    yaml_filename = "vitess_docs.yaml"
    total_saved = 0
    max_retries = 3  # Limit retries to avoid infinite loops
    sections_to_skip = 3  # Skip first 3 sections
    
    # Load already processed URLs from YAML file
    if os.path.exists(yaml_filename):
        try:
            with open(yaml_filename, 'r', encoding='utf-8') as file:
                file_content = file.read()
                yaml_data = yaml.safe_load(file_content)
                if yaml_data and "vitess" in yaml_data:
                    for entry in yaml_data["vitess"]:
                        url = entry.get("url", "")
                        if url:
                            processed_urls.add(url)
            print(f"Loaded {len(processed_urls)} already processed URLs from YAML file")
        except Exception as e:
            print(f"Error reading YAML file: {str(e)}")
    
    # Remove the starting URL from processed_urls to force reprocessing it
    if start_url and start_url in processed_urls:
        processed_urls.remove(start_url)
        print(f"Removed starting URL from processed list to reprocess it")
    
    def get_section_path_from_url(url):
        """Extract section path from URL to build proper breadcrumbs"""
        if "archive" in url:
            # Extract path for archived docs
            parts = url.split("/docs/archive/")
            if len(parts) > 1:
                path_parts = parts[1].strip("/").split("/")
                if path_parts:
                    # Format: ["Archives", "v18.0 (Archived)", "Reference", ...]
                    version = path_parts[0]
                    version_label = f"v{version} (Archived)" if version.replace(".", "").isdigit() else version
                    
                    section_path = ["Archives", version_label]
                    section_path.extend(part.capitalize() for part in path_parts[1:] if part)
                    return section_path
        
        # Default path extraction for non-archived content
        path_parts = url.replace("https://vitess.io/docs/", "").strip("/").split("/")
        if path_parts:
            return [part.capitalize() for part in path_parts]
        
        return ["Unknown"]
    
    def scrape_page(url, section_path, is_archived=False):
        """Scrape a single page and print its information"""
        nonlocal total_saved
        
        if url in processed_urls:
            print(f"Already processed {url}, skipping")
            return
        
        processed_urls.add(url)
        content = get_page_content(driver, url)
        
        # Skip pages with no content
        if not content:
            print(f"No content found at {url}, skipping")
            return
            
        char_count = count_characters(content)
        approx_token_count = estimate_tokens(content)
        
        # Extract version from URL or path more reliably
        version = "Unknown"
        
        # Special handling for Archived section - use subsection title as version
        if is_archived and len(section_path) >= 2:
            # Use the immediate subsection under Archived as version
            version = section_path[1]
        elif section_path and section_path[0]:
            version = section_path[0]
        else:
            # Try to extract version from URL if section_path is empty
            url_parts = url.split('/')
            for part in url_parts:
                if part.startswith('v') and any(c.isdigit() for c in part):
                    version = part
                    break
        
        # Create data dictionary for YAML in the exact format requested
        data = {
            "title": section_path[-1] if section_path else "Unknown",
            "url": url,
            "content": content,
            "version_or_commonresource": version,
            "char_count": char_count,
            "approx_token_count": approx_token_count
        }
        
        # Save to YAML file - id_parent will be assigned in the save_to_yaml function
        saved_id = save_to_yaml(data, yaml_filename)
        if saved_id:
            total_saved += 1
        
        # Print the scraped information
        print("\n--- Scraped Page Information ---")
        print(f"Title: {data['title']}")
        print(f"URL: {data['url']}")
        print(f"Version/Section: {data['version_or_commonresource']}")
        print(f"Character Count: {data['char_count']}")
        print(f"Approximate Token Count: {data['approx_token_count']}")
        print(f"Content Preview: {content[:150]}...")
        print(f"Saved to: {yaml_filename} with ID: {saved_id}")
        print("-------------------------------\n")
    
    def process_archives_section(start_url):
        """Special processing specifically for Archives section, focusing on sidebar navigation"""
        # Start at the specific URL
        driver.get(start_url)
        time.sleep(3)
        
        # Get initial section path
        section_path = get_section_path_from_url(start_url)
        is_archived = "archive" in start_url
        
        # First, scrape the starting page
        scrape_page(start_url, section_path, is_archived)
        
        # Find all the sidebar navigation links
        print("\nExploring sidebar navigation systematically from current position...\n")
        
        # Queue for breadth-first processing of links
        links_to_process = []
        visited_links = set([start_url])
        
        # Function to expand all collapsible sections in the sidebar
        def expand_all_sidebar_sections():
            try:
                # Expand all sidebar sections
                expand_buttons = driver.find_elements(By.CSS_SELECTOR, "button.collapse-toggle")
                for button in expand_buttons:
                    try:
                        # Check if it's not already expanded
                        parent = button.find_element(By.XPATH, "..")
                        if "expanded" not in parent.get_attribute("class"):
                            driver.execute_script("arguments[0].click();", button)
                            time.sleep(0.2)  # Small delay after expanding
                    except:
                        pass
            except Exception as e:
                print(f"Error expanding sidebar sections: {str(e)}")
        
        # Function to get the next links in order from the current position
        def get_next_links_in_sequence():
            expand_all_sidebar_sections()
            
            try:
                # Get the sidebar
                sidebar = WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "div.docs-sidebar"))
                )
                
                # Find the current active link
                current_active = None
                try:
                    current_active = driver.find_element(By.CSS_SELECTOR, "li.active > a")
                except:
                    try:
                        current_active = driver.find_element(By.CSS_SELECTOR, "a.active")
                    except:
                        pass
                
                # Get all links in the sidebar to find the next ones
                all_sidebar_links = sidebar.find_elements(By.TAG_NAME, "a")
                found_current = False
                next_links = []
                
                # First pass: look for next links at the same level
                for link in all_sidebar_links:
                    href = link.get_attribute('href')
                    if not href or not href.startswith("https://vitess.io/docs/"):
                        continue
                    
                    # If we've found our current position, start collecting next links
                    if found_current:
                        if href in visited_links or href in processed_urls:
                            continue
                            
                        try:
                            try:
                                title_element = link.find_element(By.CSS_SELECTOR, "span.navlist-tile")
                                title = title_element.text
                            except:
                                title = link.text.strip()
                            
                            if title:
                                next_links.append({"url": href, "title": title})
                                print(f"Found next link in sequence: {title} -> {href}")
                                # Return immediately after finding the next link
                                return [next_links[0]] if next_links else []
                        except:
                            pass
                        
                    # Check if this is our current link
                    if href == start_url or (current_active and href == current_active.get_attribute('href')):
                        found_current = True
                        print(f"Found current position in sidebar")
                
                # If no next links found, look at the "Next" navigation at the bottom of the page
                if not next_links:
                    print("No next links found in sidebar, looking for navigation links")
                    navigation_links = driver.find_elements(By.CSS_SELECTOR, "div.docs-navigation a")
                    for link in navigation_links:
                        href = link.get_attribute('href')
                        text = link.text.strip()
                        
                        # Look for "next" link
                        if (text and ">" in text and 
                            href and href.startswith("https://vitess.io/docs/") and 
                            href not in visited_links and href not in processed_urls):
                            next_links.append({"url": href, "title": text})
                            print(f"Found next navigation link: {text} -> {href}")
                            return next_links
                
                # If still no links found, get all unvisited links from the active parent section
                if not next_links:
                    print("No direct next links found, getting all remaining links in section")
                    active_parent = None
                    try:
                        active_elements = driver.find_elements(By.CSS_SELECTOR, "li.expanded.active")
                        if active_elements:
                            active_parent = active_elements[-1]  # Get the most specific active parent
                    except:
                        pass
                    
                    if active_parent:
                        parent_links = active_parent.find_elements(By.TAG_NAME, "a")
                        for link in parent_links:
                            href = link.get_attribute('href')
                            if not href or not href.startswith("https://vitess.io/docs/"):
                                continue
                                
                            if href in visited_links or href in processed_urls:
                                continue
                                
                            try:
                                try:
                                    title_element = link.find_element(By.CSS_SELECTOR, "span.navlist-tile")
                                    title = title_element.text
                                except:
                                    title = link.text.strip()
                                
                                if title:
                                    next_links.append({"url": href, "title": title})
                            except:
                                pass
                
                return next_links
            except Exception as e:
                print(f"Error finding next links: {str(e)}")
                return []
        
        # Get the next link after our starting point
        next_links = get_next_links_in_sequence()
        if next_links:
            links_to_process.extend(next_links)
        else:
            print("No next links found after the current position")
        
        # Process each link in order
        while links_to_process:
            link_info = links_to_process.pop(0)  # Get the next link from the beginning (FIFO)
            url = link_info["url"]
            title = link_info["title"]
            
            if url in visited_links or url in processed_urls:
                continue
                
            visited_links.add(url)
            print(f"\nNavigating to next item: {title} -> {url}")
            
            try:
                # Navigate to the URL
                driver.get(url)
                time.sleep(2)
                
                # Get the section path
                new_section_path = get_section_path_from_url(url)
                
                # Scrape the page content
                scrape_page(url, new_section_path, is_archived)
                
                # Find the next link in sequence
                next_links = get_next_links_in_sequence()
                
                # Add next links to our processing queue
                if next_links:
                    links_to_process = next_links + links_to_process  # Add to beginning
                    print(f"Found next link in sequence to process")
                else:
                    print(f"No more links found in sequence, continuing with remaining links")
                
            except Exception as e:
                print(f"Error processing link {url}: {str(e)}")
                continue
        
        print("\nCompleted sequential sidebar navigation\n")
    
    # If starting from a specific URL
    if start_url:
        try:
            print(f"Starting scraping from specific URL: {start_url}")
            
            # For archive URLs, use our specialized sidebar-focused processing
            if "archive" in start_url:
                process_archives_section(start_url)
            else:
                # Use standard processing for non-archive URLs
                section_path = get_section_path_from_url(start_url)
                print(f"Detected section path: {' > '.join(section_path)}")
                
                # Determine is_archived and current_section_prefix
                is_archived = False
                
                # For non-archive URLs, use standard prefix extraction
                url_parts = start_url.split("/")
                if len(url_parts) >= 5:
                    current_section_prefix = "/".join(url_parts[:5]) + "/"
                else:
                    current_section_prefix = start_url
                
                print(f"Using section prefix: {current_section_prefix}")
                
                # Process using standard approach
                process_section(start_url, section_path, 0, current_section_prefix)
                
            # After processing the starting URL, continue with standard section processing
            print("Continuing with remaining sections...")
            
        except Exception as e:
            print(f"Error processing starting URL: {str(e)}")
    
    # Track completed top-level sections to ensure we process all of them
    completed_sections = set()
    sections_to_process = []
    
    try:
        driver.get(base_url)
        time.sleep(3)
        
        # Wait for sidebar to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "div.docs-menu"))
        )
        
        # Get all top-level categories in the order they appear
        main_categories = WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "div.docs-menu > ul.docs-navlist > li > a"))
        )
        
        # First, collect all sections that need processing
        for i, category in enumerate(main_categories):
            try:
                # Skip the first N sections
                if i < sections_to_skip:
                    title_element = category.find_element(By.CSS_SELECTOR, "span.navlist-tile")
                    title = title_element.text
                    print(f"Skipping section {i+1}: {title}")
                    continue
                
                title_element = category.find_element(By.CSS_SELECTOR, "span.navlist-tile")
                title = title_element.text
                url = category.get_attribute('href')
                
                # Skip if already processed (check the main URL)
                if url in processed_urls:
                    print(f"Section already processed: {title}")
                    completed_sections.add(url)
                    continue
                
                if title and url:
                    sections_to_process.append({
                        "title": title,
                        "url": url,
                        "index": i+1
                    })
            except Exception as e:
                print(f"Error collecting category #{i+1}: {str(e)}")
                continue
        
        # Process each section one by one
        print(f"Found {len(sections_to_process)} sections to process")
        for section in sections_to_process:
            title = section["title"]
            url = section["url"]
            i = section["index"]
            
            try:
                print(f"\n===== Processing section {i}: {title} =====\n")
                
                # Set the current section URL prefix
                # For Archives section, don't restrict by URL prefix so we can grab all subversions
                if title == "Archives":
                    current_section_prefix = None
                # For versioned sections, set prefix appropriately
                elif "/docs/22.0/" in url:
                    current_section_prefix = "https://vitess.io/docs/22.0/"
                elif "/docs/21.0/" in url:
                    current_section_prefix = "https://vitess.io/docs/21.0/"
                elif "/docs/20.0/" in url:
                    current_section_prefix = "https://vitess.io/docs/20.0/"
                else:
                    # For other sections like Learning Resources, use the direct URL as prefix
                    # This ensures we stay within this section
                    url_parts = url.split("/")
                    if len(url_parts) >= 5:
                        # Get the section path from the URL
                        current_section_prefix = "/".join(url_parts[:5]) + "/"
                    else:
                        current_section_prefix = url
                
                # Process the section and all its subsections
                process_section(url, [title], 0, current_section_prefix)
                
                # Mark section as completed
                completed_sections.add(url)
                print(f"\n===== Completed processing section: {title} =====\n")
            except Exception as e:
                print(f"Error processing section {title}: {str(e)}")
                continue
        
        print(f"All sections processed. Completed {len(completed_sections)} sections.")
        
    except Exception as e:
        print(f"Error in main processing: {str(e)}")
    
    return total_saved, yaml_filename

def scrape_from_section(headless=True, start_url=None):
    """
    Start scraping from all sections, optionally starting from a specific URL
    """
    driver = setup_driver(headless)
    base_url = "https://vitess.io/docs/"
    
    try:
        if start_url:
            print(f"Starting scrape from specific URL: {start_url}")
        else:
            print("Starting scrape from documentation, processing all sections automatically")
        
        # Use the recursive scraper with optional start URL
        pages_processed, yaml_file = scrape_docs_recursive(driver, base_url, start_url)
        
        # Print summary
        print("\n===== Scraping Summary =====")
        print(f"Total pages processed: {pages_processed}")
        print(f"All data saved to: {yaml_file}")
        print("All sections have been processed!")
        
    finally:
        print("Closing the WebDriver.")
        time.sleep(2)
        driver.quit()

if __name__ == "__main__":
    # Start scraping from the specified URL
    start_url = "https://vitess.io/docs/archive/13.0/reference/features/mysql-replication/"
    scrape_from_section(headless=True, start_url=start_url)