import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, StyleSheet, View } from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Index() {
  const webRef = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (canGoBack.current) {
          webRef.current?.goBack();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, []),
  );

  // react-native-webview is native-only; on the Expo web preview render a real iframe.
  if (Platform.OS === "web") {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        {React.createElement("iframe", {
          src: WEB_URL,
          title: "Arena Dex",
          "data-testid": "game-webview-web",
          style: { border: "none", width: "100%", height: "100%", backgroundColor: "#05070c" },
          allow: "fullscreen; autoplay",
        })}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <WebView
        ref={webRef}
        testID="game-webview"
        source={{ uri: WEB_URL }}
        style={styles.web}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        onNavigationStateChange={(n: WebViewNavigation) => {
          canGoBack.current = n.canGoBack;
        }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <View style={styles.loader} pointerEvents="none" testID="game-webview-loading">
          <ActivityIndicator size="large" color="#22d3ee" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#05070c",
  },
  web: {
    flex: 1,
    backgroundColor: "#05070c",
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#05070c",
  },
});
