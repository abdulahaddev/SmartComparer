import os
import zipfile
import shutil

# The name of the output zip file
DIST_DIR = "dist"
OUTPUT_FILENAME = os.path.join(DIST_DIR, "smartcompare_api.zip")

# Directories to exclude from the zip
EXCLUDE_DIRS = {
    "venv", 
    "__pycache__", 
    ".git", 
    ".pytest_cache", 
    ".vscode", 
    "scratch",
    "dist",
    "tests"  # Optional, but testing files aren't needed in production
}

# Files to exclude
EXCLUDE_FILES = {
    "smartcompare_api.zip",
    "build_zip.py",
    ".env.example",
    "test_playwright.py"
}

def is_excluded(_path, root, is_dir=False):
    # Get the relative path
    rel_path = os.path.relpath(os.path.join(root, _path), start=".")
    
    # Check if the file/folder starts with any of the excluded directory names
    parts = rel_path.split(os.sep)
    
    # For directories, check if the exact name is excluded
    if is_dir and _path in EXCLUDE_DIRS:
        return True
        
    # Check if any path part matches an excluded directory
    for part in parts:
        if part in EXCLUDE_DIRS:
            return True
            
    # For files, check exact matching
    if not is_dir and _path in EXCLUDE_FILES:
        return True
        
    return False

def build_zip():
    if not os.path.exists(DIST_DIR):
        os.makedirs(DIST_DIR)
        
    print(f"Creating {OUTPUT_FILENAME}...")
    
    # Remove existing zip if it exists
    if os.path.exists(OUTPUT_FILENAME):
        os.remove(OUTPUT_FILENAME)
        
    file_count = 0
    with zipfile.ZipFile(OUTPUT_FILENAME, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk("."):
            # Subdir cleanup in-place prevents os.walk from entering excluded dirs
            dirs[:] = [d for d in dirs if not is_excluded(d, root, is_dir=True)]
            
            for file in files:
                if not is_excluded(file, root, is_dir=False):
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, start=".")
                    zipf.write(file_path, arcname)
                    file_count += 1                
        
    print(f"\nSuccess! Packed {file_count} files into {OUTPUT_FILENAME}")
    print(f"I've also copied requirements.txt into the {DIST_DIR} folder!")
    print(f"You can now upload the contents of the {DIST_DIR} folder directly to cPanel.")

if __name__ == "__main__":
    build_zip()
