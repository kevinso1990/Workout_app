const { withXcodeProject, IOSConfig } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PRIVACY_MANIFEST = "PrivacyInfo.xcprivacy";

/**
 * Copies privacy/PrivacyInfo.xcprivacy into the iOS target during prebuild
 * and registers it as a resource in the Xcode project.
 */
function withPrivacyManifest(config) {
  return withXcodeProject(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const platformProjectRoot = config.modRequest.platformProjectRoot;
    const src = path.join(projectRoot, "privacy", PRIVACY_MANIFEST);

    if (!fs.existsSync(src)) {
      throw new Error(
        `Missing ${src}. Add privacy/PrivacyInfo.xcprivacy before running prebuild.`,
      );
    }

    const project = config.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const dest = path.join(platformProjectRoot, projectName, PRIVACY_MANIFEST);

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);

    const filePath = `${projectName}/${PRIVACY_MANIFEST}`;

    if (!project.hasFile(filePath)) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: filePath,
        groupName: projectName,
        project,
        isBuildFile: true,
      });
    }

    return config;
  });
}

module.exports = withPrivacyManifest;
