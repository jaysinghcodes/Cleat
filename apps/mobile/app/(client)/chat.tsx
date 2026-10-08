import {
  CleatRequestError,
  ensureThread,
  listMessages,
  sendChatMessage,
  subscribeToThread,
} from "@cleat/api";
import {
  chatCopy,
  clientAiPresentation,
  initials,
  mergeMessages,
  messagePlaceholder,
  splitMessageBody,
  upsertMessage,
  type Message,
} from "@cleat/domain";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banner } from "../../components/ui";
import { useSession } from "../../lib/session";
import { useTheme } from "../../theme";

function deskOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_DESK_URL?.trim().replace(/\/$/, "");
  return configured || "http://localhost:3000";
}

function MessageBody({ body, mine }: { body: string; mine: boolean }) {
  const { tokens } = useTheme();
  const parts = splitMessageBody(body);
  return (
    <Text
      style={{
        color: mine ? tokens.onAccent : tokens.text,
        fontSize: 14,
        lineHeight: 20,
      }}
    >
      {parts.map((part, index) =>
        part.kind === "link" ? (
          <Text
            key={`${part.text}-${index}`}
            style={{
              color: mine ? tokens.onAccent : tokens.accentText,
              textDecorationLine: "underline",
            }}
            onPress={() => {
              void Linking.openURL(part.text);
            }}
          >
            {part.text}
          </Text>
        ) : (
          <Text key={`text-${index}`}>{part.text}</Text>
        ),
      )}
    </Text>
  );
}

export default function ChatScreen() {
  const { client, session, coach } = useSession();
  const { tokens } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const stick = useRef(true);
  const coachName = coach?.displayName ?? "Your coach";

  const load = useCallback(async () => {
    if (!client || !session) return;
    setLoading(true);
    try {
      const id = await ensureThread(client, session.userId);
      setThreadId(id);
      const page = await listMessages(client, id);
      setMessages(page.messages);
      setHasMore(page.hasMore);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof CleatRequestError ? err.message : chatCopy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [client, session]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!client || !threadId) return;
    return subscribeToThread(client, threadId, (incoming) => {
      setMessages((current) => upsertMessage(current, incoming));
    });
  }, [client, threadId]);

  useEffect(() => {
    if (!stick.current) return;
    scroller.current?.scrollToEnd({ animated: false });
  }, [messages, loading]);

  async function onEarlier() {
    if (!client || !threadId || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest) return;
    stick.current = false;
    setLoadingEarlier(true);
    setError(null);
    try {
      const page = await listMessages(client, threadId, { before: oldest.createdAt });
      setHasMore(page.hasMore);
      setMessages((current) => mergeMessages(page.messages, current));
    } catch (err: unknown) {
      setError(err instanceof CleatRequestError ? err.message : chatCopy.loadFailed);
    } finally {
      setLoadingEarlier(false);
    }
  }

  async function onSend() {
    if (!client) return;
    stick.current = true;
    setSending(true);
    setError(null);
    try {
      const message = await sendChatMessage(client, deskOrigin(), { body: draft });
      setDraft("");
      setThreadId(message.threadId);
      const page = await listMessages(client, message.threadId);
      setMessages(page.messages);
      setHasMore(page.hasMore);
    } catch (err: unknown) {
      setError(err instanceof CleatRequestError ? err.message : chatCopy.sendFailed);
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.page }} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tokens.bgSoft,
                borderWidth: 1,
                borderColor: tokens.border,
              }}
            >
              <Text style={{ color: tokens.textSecondary, fontWeight: "700", fontSize: 13 }}>
                {initials(coachName)}
              </Text>
            </View>
            <View>
              <Text style={{ color: tokens.text, fontWeight: "600", fontSize: 16 }}>{coachName}</Text>
              <Text style={{ color: tokens.textSecondary, fontSize: 12, marginTop: 2 }}>{chatCopy.coachMeta}</Text>
            </View>
          </View>
          {error ? <Banner message={error} /> : null}
          <ScrollView
            ref={scroller}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 12, gap: 10, flexGrow: 1 }}
            onContentSizeChange={() => {
              if (stick.current) scroller.current?.scrollToEnd({ animated: false });
            }}
          >
            {hasMore ? (
              <Pressable
                accessibilityRole="button"
                disabled={loadingEarlier}
                onPress={() => void onEarlier()}
                style={{ alignSelf: "center", paddingVertical: 8 }}
              >
                <Text style={{ color: tokens.accentText, fontWeight: "600", fontSize: 13 }}>
                  {chatCopy.loadEarlier}
                </Text>
              </Pressable>
            ) : null}
            {loading ? (
              <Text style={{ color: tokens.textSecondary, textAlign: "center", marginTop: 24 }}>
                {chatCopy.loading}
              </Text>
            ) : null}
            {!loading && messages.length === 0 ? (
              <Text
                style={{
                  color: tokens.textSecondary,
                  textAlign: "center",
                  marginTop: 24,
                  lineHeight: 20,
                }}
              >
                {chatCopy.clientEmpty}
              </Text>
            ) : null}
            {messages.map((message) => {
              const view = clientAiPresentation(message, coachName);
              if (view) {
                return (
                  <View
                    key={message.id}
                    style={{
                      alignSelf: "flex-start",
                      maxWidth: "86%",
                      backgroundColor: tokens.bgSoft,
                      borderColor: tokens.borderSoft,
                      borderWidth: 1,
                      borderRadius: 16,
                      borderBottomLeftRadius: 4,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: tokens.accent,
                        }}
                      />
                      <Text style={{ color: tokens.textSecondary, fontSize: 12, fontWeight: "600" }}>{view.label}</Text>
                    </View>
                    <MessageBody body={message.body} mine={false} />
                    {view.sources ? (
                      <Text style={{ color: tokens.textSecondary, fontSize: 12, marginTop: 8 }}>{view.sources}</Text>
                    ) : null}
                    {view.footer ? (
                      <Text style={{ color: tokens.textSecondary, fontSize: 12, marginTop: 4 }}>{view.footer}</Text>
                    ) : null}
                  </View>
                );
              }
              const mine = message.senderId === session?.userId;
              return (
                <View
                  key={message.id}
                  style={{
                    alignSelf: mine ? "flex-end" : "flex-start",
                    maxWidth: "86%",
                    backgroundColor: mine ? tokens.accent : tokens.bgSoft,
                    borderColor: mine ? tokens.accent : tokens.borderSoft,
                    borderWidth: mine ? 0 : 1,
                    borderRadius: 16,
                    borderBottomRightRadius: mine ? 4 : 16,
                    borderBottomLeftRadius: mine ? 16 : 4,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                >
                  <MessageBody body={message.body} mine={mine} />
                </View>
              );
            })}
          </ScrollView>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              paddingTop: 10,
              paddingBottom: 12,
              borderTopWidth: 1,
              borderTopColor: tokens.borderSoft,
              alignItems: "center",
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={coach ? messagePlaceholder(coach.displayName) : chatCopy.writeMessage}
              placeholderTextColor={tokens.textTertiary}
              accessibilityLabel={chatCopy.writeMessage}
              maxLength={4000}
              style={{
                flex: 1,
                color: tokens.text,
                backgroundColor: tokens.input,
                borderColor: tokens.border,
                borderWidth: 1,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
              }}
            />
            <Pressable
              accessibilityRole="button"
              disabled={sending || draft.trim().length === 0}
              onPress={() => void onSend()}
              style={{
                backgroundColor: tokens.accent,
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 12,
                opacity: sending || draft.trim().length === 0 ? 0.6 : 1,
              }}
            >
              <Text style={{ color: tokens.onAccent, fontWeight: "600", fontSize: 14 }}>{chatCopy.send}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
