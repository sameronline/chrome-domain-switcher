#!/bin/bash

# Check if ImageMagick/convert is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed. Please install it to generate icons."
    echo "On Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "On macOS with Homebrew: brew install imagemagick"
    exit 1
fi

# Directory where the icons will be stored
ICON_DIR="icons"

# Check if the icons directory exists
if [ ! -d "$ICON_DIR" ]; then
    echo "Error: icons directory not found"
    exit 1
fi

# SVG source file
SVG_FILE="$ICON_DIR/icon.svg"

# Check if the SVG file exists
if [ ! -f "$SVG_FILE" ]; then
    echo "Error: SVG icon file not found at $SVG_FILE"
    exit 1
fi

# Generate icons in different sizes
echo "Generating icons from SVG..."

# Define icon sizes
SIZES=(16 32 48 128)

for size in "${SIZES[@]}"; do
    echo "Creating $size x $size icon..."
    convert -background none -resize ${size}x${size} "$SVG_FILE" "$ICON_DIR/icon${size}.png"
done

echo "Icons generated successfully!"
echo "You can now load the extension in Chrome." 