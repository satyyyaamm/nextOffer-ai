import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { track } from "../analytics";
import { IconChat, IconX } from "../icons";
import { C } from "../theme";
import {
  SUPPORT_EMAIL,
  findBestFaq,
  getRelatedFaq,
  getSuggestedFaq,
} from "./faqContent";
import { useHelpFaq } from "./HelpFaqContext";

const WELCOME_MESSAGE =
  "Hi! I'm here to help you use NextOffer.ai — uploading your resume, searching jobs, building application kits, and Pro billing. Pick a topic below or type your question.";

const NO_MATCH_MESSAGE = `I couldn't find an exact answer for that. Try one of the topics below, or email ${SUPPORT_EMAIL} and we'll help you out.`;

function ChatRichText({ text }) {
  const parts = text.split(/(ranurainfotech@gmail\.com)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part === "ranurainfotech@gmail.com") {
          return (
            <a key={i} href={`mailto:${SUPPORT_EMAIL}`} className="help-chat-link">
              {part}
            </a>
          );
        }
        return part;
      })}
    </>
  );
}

function QuickReplies({ items, onSelect, disabled }) {
  if (!items.length) return null;
  return (
    <div className="help-chat-quick-replies" role="list">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="help-chat-quick-replies__chip"
          disabled={disabled}
          onClick={() => onSelect(item)}
        >
          {item.question}
        </button>
      ))}
    </div>
  );
}

export function HelpFaqWidget() {
  const { open, close, isOpen, context } = useHelpFaq();
  const fabRef = useRef(null);
  const panelRef = useRef(null);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [askedIds, setAskedIds] = useState(() => new Set());
  const [quickReplies, setQuickReplies] = useState([]);
  const [pending, setPending] = useState(false);

  const mobileDockVisible = Boolean(context.mobileDockVisible);
  const upgradeModalOpen = Boolean(context.upgradeModalOpen);

  const initialSuggestions = useMemo(() => getSuggestedFaq(context, 4), [context]);
  const wasOpenRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = messagesRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const resetChat = useCallback(() => {
    setInput("");
    setMessages([{ id: "welcome", role: "bot", text: WELCOME_MESSAGE }]);
    setAskedIds(new Set());
    setQuickReplies(initialSuggestions);
    setPending(false);
  }, [initialSuggestions]);

  const handleOpen = useCallback(() => {
    if (upgradeModalOpen) return;
    open();
    track("help_faq_open", {
      is_logged_in: context.isLoggedIn ? 1 : 0,
      screen: context.screen || "landing",
    });
  }, [open, upgradeModalOpen, context.isLoggedIn, context.screen]);

  const handleClose = useCallback(() => {
    close();
    fabRef.current?.focus();
  }, [close]);

  const respondWithFaq = useCallback(
    (faqItem, source) => {
      track("help_faq_question", { question_id: faqItem.id, source });
      setAskedIds((prev) => {
        const next = new Set(prev);
        next.add(faqItem.id);
        const related = getRelatedFaq(faqItem, next, 3);
        setQuickReplies(related.length > 0 ? related : getSuggestedFaq(context, 3).filter((i) => !next.has(i.id)));
        return next;
      });
      setMessages((prev) => [
        ...prev,
        { id: `bot-${faqItem.id}-${Date.now()}`, role: "bot", text: faqItem.answer, faqId: faqItem.id },
      ]);
      setPending(false);
      scrollToBottom();
    },
    [context, scrollToBottom],
  );

  const askQuestion = useCallback(
    (rawText, faqItem = null, source = "input") => {
      const text = rawText.trim();
      if (!text || pending) return;

      const item = faqItem || findBestFaq(text);
      setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", text: faqItem ? faqItem.question : text }]);
      setQuickReplies([]);
      setPending(true);
      setInput("");
      scrollToBottom();

      window.setTimeout(() => {
        if (item) {
          respondWithFaq(item, source);
        } else {
          setMessages((prev) => [
            ...prev,
            { id: `bot-fallback-${Date.now()}`, role: "bot", text: NO_MATCH_MESSAGE },
          ]);
          setQuickReplies(getSuggestedFaq(context, 4).filter((i) => !askedIds.has(i.id)));
          setPending(false);
          scrollToBottom();
        }
      }, 350);
    },
    [pending, respondWithFaq, context, askedIds, scrollToBottom],
  );

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      askQuestion(input);
    },
    [askQuestion, input],
  );

  const handleQuickReply = useCallback(
    (item) => {
      askQuestion(item.question, item, "suggestion");
    },
    [askQuestion],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      resetChat();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, resetChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, quickReplies, scrollToBottom]);

  return (
    <>
      {!isOpen && (
        <button
          ref={fabRef}
          type="button"
          className={`help-faq-fab${mobileDockVisible ? " help-faq-fab--dock-offset" : ""}`}
          aria-label="Open help chat"
          onClick={handleOpen}
        >
          <IconChat size={22} color="#ffffff" />
        </button>
      )}

      {isOpen && (
        <div className="help-chat-modal" role="dialog" aria-modal="true" aria-labelledby="help-chat-title">
          <button type="button" className="help-chat-modal__backdrop" aria-label="Close help chat" onClick={handleClose} />
          <div
            ref={panelRef}
            className={`help-chat-modal__panel${mobileDockVisible ? " help-chat-modal__panel--dock-offset" : ""}`}
          >
            <header className="help-chat-header">
              <div className="help-chat-header__avatar" aria-hidden="true">
                <IconChat size={18} color="#ffffff" />
              </div>
              <div className="help-chat-header__info">
                <h2 id="help-chat-title" className="help-chat-header__title">
                  NextOffer Help
                </h2>
                <p className="help-chat-header__status">Ask about the app, applying, or Pro</p>
              </div>
              <button type="button" className="help-chat-header__close" aria-label="Close" onClick={handleClose}>
                <IconX size={20} color={C.sub} />
              </button>
            </header>

            <div ref={messagesRef} className="help-chat-messages" aria-live="polite">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`help-chat-row help-chat-row--${msg.role}`}
                >
                  {msg.role === "bot" && (
                    <div className="help-chat-avatar help-chat-avatar--bot" aria-hidden="true">
                      <IconChat size={14} color={C.accent} />
                    </div>
                  )}
                  <div className={`help-chat-bubble help-chat-bubble--${msg.role}`}>
                    <ChatRichText text={msg.text} />
                  </div>
                </div>
              ))}

              {pending && (
                <div className="help-chat-row help-chat-row--bot">
                  <div className="help-chat-avatar help-chat-avatar--bot" aria-hidden="true">
                    <IconChat size={14} color={C.accent} />
                  </div>
                  <div className="help-chat-bubble help-chat-bubble--bot help-chat-bubble--typing" aria-label="Typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}

              {!pending && quickReplies.length > 0 && (
                <QuickReplies items={quickReplies} onSelect={handleQuickReply} disabled={pending} />
              )}
            </div>

            <form className="help-chat-composer" onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                className="help-chat-composer__input"
                placeholder="Ask how to use the app…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={pending}
                aria-label="Type your question"
                autoComplete="off"
              />
              <button
                type="submit"
                className="help-chat-composer__send"
                disabled={pending || !input.trim()}
                aria-label="Send message"
              >
                Send
              </button>
            </form>

            <footer className="help-chat-footer">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="help-chat-link">
                Contact support
              </a>
              <span aria-hidden="true"> · </span>
              <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="help-chat-link">
                Privacy
              </a>
              <span aria-hidden="true"> · </span>
              <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="help-chat-link">
                Terms
              </a>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
