const { getDefaultConfig } = require("expo/metro-config");

// Expo SDK 52+ detects the pnpm workspace and configures Metro.
// Keep this file so the app uses expo/metro-config explicitly.
/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
