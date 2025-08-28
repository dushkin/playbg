#!/bin/bash

# Navigate to backend directory
cd apps/backend

# Try to build
echo "Building backend..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build successful!"
    
    # Go back to root directory
    cd ../..
    
    # Add all changes
    git add -A
    
    # Commit changes
    git commit -m "Fix Express TypeScript import conflicts and build issues"
    
    # Push changes
    git push origin dev
    
    echo "Changes pushed successfully!"
else
    echo "Build failed. Please check the errors above."
fi
