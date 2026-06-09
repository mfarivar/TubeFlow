import os
import subprocess
import shutil

def convert_png_to_icns(png_path, output_icns_path):
    print(f"Converting {png_path} to {output_icns_path}...")
    
    # Create the temporary iconset folder
    iconset_dir = "logo.iconset"
    if os.path.exists(iconset_dir):
        shutil.rmtree(iconset_dir)
    os.makedirs(iconset_dir)
    
    # Standard macOS icon sizes and names
    icon_sizes = [
        (16, "icon_16x16.png"),
        (32, "icon_16x16@2x.png"),
        (32, "icon_32x32.png"),
        (64, "icon_32x32@2x.png"),
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"),
        (512, "icon_256x256@2x.png"),
        (512, "icon_512x512.png"),
        (1024, "icon_512x512@2x.png")
    ]
    
    # Generate each size using sips (macOS native image processor)
    for size, name in icon_sizes:
        out_path = os.path.join(iconset_dir, name)
        cmd = [
            "sips",
            "-z", str(size), str(size),
            png_path,
            "--out", out_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Error scaling image to {size}x{size}: {result.stderr}")
            return False
            
    # Compile the iconset into an .icns file using iconutil
    cmd = ["iconutil", "-c", "icns", iconset_dir, "-o", output_icns_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    # Clean up the iconset directory
    shutil.rmtree(iconset_dir)
    
    if result.returncode == 0 and os.path.exists(output_icns_path):
        print(f"Successfully generated ICNS icon: {output_icns_path}")
        return True
    else:
        print(f"Failed to generate ICNS file: {result.stderr}")
        return False

if __name__ == "__main__":
    src_png = "/Users/max/.gemini/antigravity/brain/ba75ecee-9a76-457b-9a45-37d6e704ecfb/media__1780999611498.png"
    dest_icns = "/Users/max/Documents/All Work/2026-06-09 Youtube Downloader/logo.icns"
    convert_png_to_icns(src_png, dest_icns)
