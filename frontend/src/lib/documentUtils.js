/**
 * Utility functions for document handling and versioning
 */

/**
 * Groups versioned documents based on their base name
 * @param {Array} files - Array of file objects 
 * @returns {Array} - Array with grouped versioned files
 */
export function groupVersionedDocuments(files) {
  if (!files || files.length === 0) return [];

  // Create a map to group files by their base name
  const fileGroups = {};
  
  // First pass: identify original files and versioned files
  files.forEach(file => {
    const filename = file.filename || "";
    
    // Check if file has version pattern (ends with _vN.ext)
    const versionMatch = filename.match(/^(.+)_v(\d+)\.([^.]+)$/);
    
    if (versionMatch) {
      // This is a versioned file
      const baseName = versionMatch[1];
      const version = parseInt(versionMatch[2], 10);
      const extension = versionMatch[3];
      const baseFilename = `${baseName}.${extension}`;
      
      // Create group if it doesn't exist
      if (!fileGroups[baseFilename]) {
        fileGroups[baseFilename] = {
          isVersioned: true,
          baseFilename: baseFilename,
          baseName: baseName,
          extension: extension,
          originalFile: null,
          versions: [],
          highestVersion: 0
        };
      }
      
      // Add this version to the group
      fileGroups[baseFilename].versions.push({
        ...file,
        versionNumber: version
      });
      
      // Keep track of the highest version number
      if (version > fileGroups[baseFilename].highestVersion) {
        fileGroups[baseFilename].highestVersion = version;
      }
    } else {
      // This might be an original file or a file without versions
      // Store it by its full filename for now
      if (!fileGroups[filename]) {
        fileGroups[filename] = {
          isVersioned: false,
          baseFilename: filename,
          originalFile: file,
          versions: []
        };
      } else {
        // If the entry already exists (from versioned files), update the original file
        fileGroups[filename].originalFile = file;
      }
    }
  });
  
  // Second pass: match original files with their versions
  Object.keys(fileGroups).forEach(key => {
    const group = fileGroups[key];
    
    // Skip groups that are already versioned or have no versions
    if (group.isVersioned || group.versions.length > 0) return;
    
    // Check if there's a version group for this file
    const baseName = key.split('.')[0];
    const extension = key.split('.')[1];
    
    // Look for a group that would contain versions of this file
    Object.keys(fileGroups).forEach(otherKey => {
      const otherGroup = fileGroups[otherKey];
      
      if (otherGroup.isVersioned && 
          otherGroup.baseName === baseName && 
          otherGroup.extension === extension) {
        
        // This is the versioned group for our original file
        otherGroup.originalFile = group.originalFile;
        
        // Mark the original group for deletion
        fileGroups[key] = null;
      }
    });
  });
  
  // Convert the map back to an array, filtering out null entries
  const result = [];
  
  Object.entries(fileGroups).forEach(([key, group]) => {
    if (!group) return; // Skip deleted groups
    
    if (group.versions.length > 0) {
      // This is a group with versions
      
      // Sort versions in descending order (latest first)
      group.versions.sort((a, b) => b.versionNumber - a.versionNumber);
      
      // If we have an original file, use it as the main file
      // Otherwise use the latest version
      const baseFile = group.originalFile || group.versions[0];
      
      // Create a combined file object representing all versions
      result.push({
        ...baseFile,
        isVersioned: true,
        originalFile: group.originalFile,
        versions: group.versions,
        baseFilename: group.baseFilename,
        versionCount: group.versions.length + (group.originalFile ? 1 : 0)
      });
    } else if (group.originalFile) {
      // This is a non-versioned file
      result.push({
        ...group.originalFile,
        isVersioned: false,
        versions: []
      });
    }
  });
  
  return result;
  
  return result;
}

/**
 * Gets the display name for a file, showing version info if applicable
 * @param {Object} file - File object
 * @returns {String} - Display name for the file
 */
export function getFileDisplayName(file) {
  if (!file) return "";
  
  if (file.isVersioned) {
    // If we have an original file, use its name as the main display
    // Otherwise use the baseFilename we generated
    const displayName = file.originalFile ? file.originalFile.filename : file.baseFilename;
    return `${displayName} (${file.versionCount} versiones)`;
  }
  
  return file.filename;
}
