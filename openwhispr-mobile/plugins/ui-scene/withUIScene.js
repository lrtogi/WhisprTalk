/**
 * Expo config plugin that adopts the UIScene life cycle.
 *
 * Xcode 27 / iOS 27 SDK terminates at launch any app that still drives its
 * window from the app delegate ("UIScene life cycle is required for apps built
 * with this SDK"). Expo SDK 55 and React Native 0.83 do not adopt scenes, so
 * this plugin adds a SceneDelegate to the app target, registers it in
 * Info.plist, and moves window creation out of the generated AppDelegate.
 */

const {
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FILE_NAME = 'SceneDelegate.swift';
const SOURCE = path.join(__dirname, 'ios', FILE_NAME);

// The block the Expo template uses to start React Native from the app delegate.
const WINDOW_BLOCK =
  /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n/;

function patchAppDelegate(contents) {
  if (contents.includes('var launchOptions:')) return contents;
  if (!WINDOW_BLOCK.test(contents)) {
    throw new Error(
      '[ui-scene] AppDelegate.swift no longer matches the Expo template; update withUIScene.js',
    );
  }
  return contents
    .replace(
      WINDOW_BLOCK,
      '    // The window is created by SceneDelegate (plugins/ui-scene).\n    self.launchOptions = launchOptions\n',
    )
    .replace(
      '  var reactNativeFactory: RCTReactNativeFactory?\n',
      '  var reactNativeFactory: RCTReactNativeFactory?\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n',
    );
}

function findMainGroupKey(xcodeProject, projectName) {
  const groups = xcodeProject.hash.project.objects.PBXGroup || {};
  for (const key of Object.keys(groups)) {
    if (key.endsWith('_comment')) continue;
    const group = groups[key];
    if (group?.name === projectName || group?.path === projectName) return key;
  }
  return null;
}

function findMainTargetUuid(xcodeProject, projectName) {
  const targets = xcodeProject.pbxNativeTargetSection() || {};
  for (const key of Object.keys(targets)) {
    if (key.endsWith('_comment')) continue;
    if ((targets[key]?.name ?? '').replace(/"/g, '') === projectName) return key;
  }
  return null;
}

function hasFileReference(xcodeProject, fileName) {
  const refs = xcodeProject.pbxFileReferenceSection() || {};
  return Object.keys(refs).some((key) => {
    if (key.endsWith('_comment')) return false;
    const ref = refs[key];
    return (ref?.path ?? ref?.name ?? '').replace(/"/g, '').endsWith(`/${fileName}`);
  });
}

module.exports = function withUIScene(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

  config = withAppDelegate(config, (cfg) => {
    cfg.modResults.contents = patchAppDelegate(cfg.modResults.contents);
    return cfg;
  });

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectName = cfg.modRequest.projectName ?? 'OpenWhispr';
      fs.copyFileSync(
        SOURCE,
        path.join(cfg.modRequest.platformProjectRoot, projectName, FILE_NAME),
      );
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const xcodeProject = cfg.modResults;
    const projectName = cfg.modRequest.projectName ?? 'OpenWhispr';
    const groupKey = findMainGroupKey(xcodeProject, projectName);
    const targetUuid = findMainTargetUuid(xcodeProject, projectName);
    if (!groupKey || !targetUuid) {
      console.warn('[ui-scene] Could not find the main group or target');
      return cfg;
    }
    if (!hasFileReference(xcodeProject, FILE_NAME)) {
      const file = xcodeProject.addSourceFile(
        `${projectName}/${FILE_NAME}`,
        { target: targetUuid, lastKnownFileType: 'sourcecode.swift' },
        groupKey,
      );
      // Same workaround as hotkey-dictation: the xcode lib leaks "undefined" fields.
      const ref = file && xcodeProject.pbxFileReferenceSection()[file.fileRef];
      if (ref) {
        delete ref.explicitFileType;
        delete ref.includeInIndex;
      }
    }
    return cfg;
  });

  return config;
};

module.exports.patchAppDelegate = patchAppDelegate;
