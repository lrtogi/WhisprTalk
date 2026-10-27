const fs = require('fs');
const path = require('path');
const baseConfig = require('./app.base.json');
const { resolveOpenWhisprEnvironment } = require('./config/openwhispr-environments');

// Yowza is licensed, so the files are git-ignored and fetched by
// `npm run download:brand-fonts`. They are embedded in the native binary (never
// the JS bundle, so OTA updates don't carry them) and src/lib/fonts.ts falls
// back to Space Grotesk when a build has none.
const BRAND_FONTS = [
  'assets/fonts/yowza/yowza-std-regular.otf',
  'assets/fonts/yowza/yowza-soft-std-medium.otf',
];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function singleOrMany(values) {
  const result = unique(values);
  return result.length === 1 ? result[0] : result;
}

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deriveGoogleCalendarRedirectScheme(clientId) {
  const suffix = '.apps.googleusercontent.com';
  const trimmed = firstNonEmpty(clientId);
  if (!trimmed || !trimmed.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${trimmed.slice(0, -suffix.length)}`;
}

function createGoogleCalendarRedirectConfig(environment, clientId) {
  const devRedirectUri = firstNonEmpty(
    process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_IOS_REDIRECT_URI_DEV,
  );
  const prodRedirectUri = firstNonEmpty(process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_IOS_REDIRECT_URI);
  const devRedirectScheme = firstNonEmpty(
    process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_IOS_REDIRECT_SCHEME_DEV,
  );
  const prodRedirectScheme = firstNonEmpty(
    process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_IOS_REDIRECT_SCHEME,
  );
  const explicitUri = environment.isDevelopment
    ? devRedirectUri || prodRedirectUri
    : prodRedirectUri;
  const explicitScheme = environment.isDevelopment
    ? devRedirectScheme || prodRedirectScheme
    : prodRedirectScheme;
  const iosRedirectScheme =
    explicitScheme || deriveGoogleCalendarRedirectScheme(clientId) || undefined;
  const iosRedirectUri =
    explicitUri || (iosRedirectScheme ? `${iosRedirectScheme}:/oauth2redirect` : undefined);

  return { iosRedirectScheme, iosRedirectUri };
}

function createEasExtensionConfig(existingExtra, environment) {
  return {
    ...(existingExtra?.eas ?? {}),
    build: {
      ...(existingExtra?.eas?.build ?? {}),
      experimental: {
        ...(existingExtra?.eas?.build?.experimental ?? {}),
        ios: {
          ...(existingExtra?.eas?.build?.experimental?.ios ?? {}),
          appExtensions: [
            {
              targetName: 'OpenWhisprKeyboard',
              bundleIdentifier: environment.keyboardBundleIdentifier,
              entitlements: {
                'com.apple.security.application-groups': [environment.appGroupId],
              },
            },
            {
              targetName: 'OpenWhisprActivity',
              bundleIdentifier: `${environment.iosBundleIdentifier}.activity`,
              entitlements: {
                'com.apple.security.application-groups': [environment.appGroupId],
              },
            },
          ],
        },
      },
    },
  };
}

function withBrandFonts(plugins) {
  if (!BRAND_FONTS.every((font) => fs.existsSync(path.join(__dirname, font)))) return plugins;
  // expo-font is a run-once plugin, so the fonts replace its bare entry; a
  // second entry would be skipped.
  return plugins.map((plugin) =>
    plugin === 'expo-font' ? ['expo-font', { fonts: BRAND_FONTS }] : plugin,
  );
}

// OPENWHISPR_FREE_TEAM=1 builds a variant that a free Apple Personal Team can
// sign: no app extensions, no App Group, no push, no Sign in with Apple. The
// dictation keyboard and Live Activity are unavailable in that build.
const FREE_TEAM = process.env.OPENWHISPR_FREE_TEAM === '1';
const FREE_TEAM_DROPPED_PLUGINS = [
  './plugins/keyboard-extension/withKeyboardExtension',
  './plugins/activity-extension/withActivityExtension',
];
// Prebuild applies the expo-notifications and expo-apple-authentication plugins
// for every installed package, so their entitlements are stripped here. Mods run
// in reverse plugin order, so this plugin goes first in the list to run last.
const FREE_TEAM_DROPPED_ENTITLEMENTS = [
  'aps-environment',
  'com.apple.developer.applesignin',
  'com.apple.security.application-groups',
];

function withFreeTeamEntitlements(config) {
  const { withEntitlementsPlist } = require('expo/config-plugins');
  return withEntitlementsPlist(config, (cfg) => {
    for (const key of FREE_TEAM_DROPPED_ENTITLEMENTS) delete cfg.modResults[key];
    return cfg;
  });
}

function withoutFreeTeamPlugins(plugins) {
  if (!FREE_TEAM) return plugins;
  return [
    withFreeTeamEntitlements,
    ...plugins.filter(
      (plugin) =>
        !FREE_TEAM_DROPPED_PLUGINS.includes(Array.isArray(plugin) ? plugin[0] : plugin),
    ),
  ];
}

function createGoogleCalendarConfig(environment) {
  const devClientId = firstNonEmpty(process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_IOS_CLIENT_ID_DEV);
  const prodClientId = firstNonEmpty(process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_IOS_CLIENT_ID);
  const iosClientId = environment.isDevelopment ? devClientId || prodClientId : prodClientId;
  return {
    iosClientId,
    iosClientIdDev: devClientId,
    ...createGoogleCalendarRedirectConfig(environment, iosClientId),
  };
}

module.exports = () => {
  const environment = resolveOpenWhisprEnvironment();
  const expo = clone(baseConfig.expo);
  const iosInfoPlist = expo.ios?.infoPlist ?? {};
  const iosQueries = iosInfoPlist.LSApplicationQueriesSchemes ?? [];
  const googleCalendar = createGoogleCalendarConfig(environment);

  const affiliateDomain = firstNonEmpty(process.env.EXPO_PUBLIC_AFFILIATE_DOMAIN);
  const affiliatePublishableKey = firstNonEmpty(process.env.EXPO_PUBLIC_AFFILIATE_PUBLISHABLE_KEY);
  const affiliate =
    affiliateDomain && affiliatePublishableKey
      ? { domain: affiliateDomain, publishableKey: affiliatePublishableKey }
      : undefined;
  if (
    affiliate &&
    (!affiliatePublishableKey.startsWith('dub_pk_') ||
      affiliateDomain !==
        (environment.isDevelopment
          ? 'open-whispr-affiliate-sandbox.dub.link'
          : 'try.openwhispr.com'))
  )
    throw new Error(
      'Affiliate configuration must match the app environment and use a publishable key',
    );

  const ios = {
    ...expo.ios,
    // Expo writes any associatedDomains array, even an empty one, as a new entitlement.
    ...(affiliate && {
      associatedDomains: unique([
        ...(expo.ios?.associatedDomains ?? []),
        `applinks:${affiliate.domain}`,
      ]),
    }),
    bundleIdentifier: environment.iosBundleIdentifier,
    entitlements: {
      ...(expo.ios?.entitlements ?? {}),
      'com.apple.security.application-groups': [environment.appGroupId],
    },
    infoPlist: {
      ...iosInfoPlist,
      CFBundleDisplayName: environment.displayName,
      LSApplicationQueriesSchemes: unique([
        ...iosQueries,
        environment.scheme,
        googleCalendar.iosRedirectScheme,
        environment.iosBundleIdentifier,
      ]),
    },
  };
  if (FREE_TEAM) {
    ios.usesAppleSignIn = false;
    delete ios.appleTeamId; // pass DEVELOPMENT_TEAM to xcodebuild instead
    delete ios.infoPlist.NSSupportsLiveActivities; // no OpenWhisprActivity extension
  }

  return {
    ...expo,
    name: expo.name,
    scheme: singleOrMany([environment.scheme, googleCalendar.iosRedirectScheme]),
    ios,
    android: {
      ...expo.android,
      package: environment.androidPackage,
    },
    plugins: withBrandFonts(withoutFreeTeamPlugins(expo.plugins)),
    extra: {
      ...expo.extra,
      affiliate,
      openWhispr: {
        ...environment,
        googleCalendar,
      },
      eas: createEasExtensionConfig(expo.extra, environment),
    },
  };
};
