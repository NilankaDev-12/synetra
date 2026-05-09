import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

import { useDocument, useUpdateDocument } from "../../hooks/useDocuments";
import socketService from "../../services/socket";
import RemoteCursorsExtension from "../../extensions/RemoteCursorsExtension";
import { useAuth } from "../../context/AuthContext";
import { DEBOUNCE_SAVE_DELAY, QUERY_KEYS } from "../../utils/constants";
import DocumentHeader from "./DocumentHeader";
import ActiveUsers from "./ActiveUsers";
import ShareModal from "./ShareModal";
import CommentSection from "../comments/CommentSection";
import Loading from "../common/Loading";
import toast from "react-hot-toast";
import { debounce } from "../../utils/helpers";

const DocumentEditor = () => {
  const { documentId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: document, isLoading, error } = useDocument(documentId);
  const updateDocument = useUpdateDocument(documentId);

  // --- State ---
  const [activeUsers, setActiveUsers] = useState([]);
  const [cursors, setCursors] = useState({});
  const [saving, setSaving] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [hasEditPermission, setHasEditPermission] = useState(false);

  // --- Refs ---
  const userRef = useRef(user);
  const queryClientRef = useRef(queryClient);
  const editorRef = useRef(null);
  const contentLoadedRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    queryClientRef.current = queryClient;
  }, [queryClient]);

  const getMyId = useCallback(() => {
    return String(userRef.current?.id || userRef.current?._id);
  }, []);

  const CURSOR_COLORS = [
    "#e53e3e",
    "#d69e2e",
    "#38a169",
    "#3182ce",
    "#805ad5",
    "#d53f8c",
    "#dd6b20",
    "#319795",
  ];
  const userColorMap = useRef({});
  const getColorForUser = useCallback((uid) => {
    const key = String(uid);
    if (!userColorMap.current[key]) {
      const idx =
        Object.keys(userColorMap.current).length % CURSOR_COLORS.length;
      userColorMap.current[key] = CURSOR_COLORS[idx];
    }
    return userColorMap.current[key];
  }, []);

  const debouncedSaveRef = useRef(null);
  useEffect(() => {
    debouncedSaveRef.current = debounce(async (content) => {
      setSaving(true);
      try {
        await updateDocument.mutateAsync({ content });
      } catch (err) {
        toast.error("Failed to save document");
      } finally {
        setSaving(false);
      }
    }, DEBOUNCE_SAVE_DELAY);
  }, [documentId]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      RemoteCursorsExtension,
      Placeholder.configure({
        placeholder: "Start typing your document…",
      }),
    ],
    content: "",
    editable: false,
    onUpdate: ({ editor, transaction }) => {
      // Don't re-broadcast changes that came FROM the socket — this was
      // causing remote cursors to ghost-move and content to double-apply.
      if (transaction.getMeta('preventUpdate')) return;
      const html = editor.getHTML();
      const json = editor.getJSON();
      socketService.sendChanges(documentId, json, html);
      debouncedSaveRef.current?.(html);
    },
    onSelectionUpdate: ({ editor, transaction }) => {
      // Also skip cursor broadcast for remotely-applied transactions
      if (transaction.getMeta('preventUpdate')) return;
      const { from, to } = editor.state.selection;
      socketService.sendCursorPosition(documentId, { from, to });
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Feed remote cursors to TipTap — always exclude self so the native
  // caret is never overlaid by a remote-cursor decoration.
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.commands.setRemoteCursors) {
      try {
        const myId = getMyId();
        const othersOnly = Object.fromEntries(
          Object.entries(cursors).filter(([uid]) => uid !== myId),
        );
        editor.commands.setRemoteCursors(othersOnly);
      } catch (err) {
        console.error("TipTap Cursor Error:", err);
      }
    }
  }, [cursors, editor, getMyId]);

  // Permissions check
  useEffect(() => {
    if (!document || !user || !document.owner) return;

    const currentUserId = getMyId();
    const ownerId = String(document.owner._id || document.owner);

    const owner = ownerId === currentUserId;
    const editPerm = document.sharedWith?.some(
      (share) =>
        String(share.user._id || share.user) === currentUserId &&
        share.permission === "edit",
    );

    setIsOwner(owner);
    setHasEditPermission(owner || !!editPerm);
  }, [document, user, getMyId]);

  // Load initial content
  useEffect(() => {
    if (!editor || !document || contentLoadedRef.current) return;
    if (document.content !== undefined) {
      editor.commands.setContent(document.content || "", { emitUpdate: false });
      contentLoadedRef.current = true;
    }
  }, [editor, document]);

  // Toggle edit mode
  useEffect(() => {
    if (editor) editor.setEditable(hasEditPermission);
  }, [hasEditPermission, editor]);

  // ------------------------------------------------------------------
  // PRESENCE & SOCKET LOGIC
  // ------------------------------------------------------------------
  useEffect(() => {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      user?.token;

    if (!token) {
      console.warn(
        "🚨 No token found. Socket will not be able to authenticate.",
      );
    }

    const handleLoadDocument = ({ content, title }) => {
      const applyContent = (attempt = 0) => {
        const ed = editorRef.current;
        if (!ed || ed.isDestroyed) {
          if (attempt < 5) setTimeout(() => applyContent(attempt + 1), 100);
          return;
        }
        ed.commands.setContent(content || "", { emitUpdate: false });
        contentLoadedRef.current = true;
      };
      applyContent();

      queryClientRef.current.setQueryData(
        [QUERY_KEYS.DOCUMENT, documentId],
        (old) => (old ? { ...old, content, ...(title ? { title } : {}) } : old),
      );
    };

    const handleReceiveChanges = ({ delta, json }) => {
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;

      const incoming = json || delta;
      if (!incoming) return;

      try {
        const { state, view } = ed;

        // Parse incoming JSON into a full doc node
        const newDoc =
          typeof incoming === "string"
            ? state.schema.nodeFromJSON(JSON.parse(incoming))
            : state.schema.nodeFromJSON(incoming);

        // Replace the doc's entire inner content.
        // A ProseMirror doc node has:
        //   position 0           = opening token  (before first child)
        //   position 1..size-1   = actual content
        //   position nodeSize-1  = closing token
        // replaceWith(1, doc.nodeSize-1, fragment) swaps all children
        // without touching the outer doc wrapper, so no extra paragraph
        // or blank-line artifacts.
        const tr = state.tr.replaceWith(
          1,
          state.doc.nodeSize - 1,
          newDoc.content,
        );

        tr.setMeta("addToHistory", false);
        tr.setMeta("preventUpdate", true);

        view.dispatch(tr);
      } catch (_outerErr) {
        // Final fallback: setContent (no position arithmetic)
        try {
          ed.commands.setContent(incoming, { emitUpdate: false });
        } catch (err) {
          console.warn("setContent fallback also failed:", err);
        }
      }
    };

    const handleActiveUsers = ({ users }) => {
      if (!users) return;
      const normalized = users.map((u) => ({
        ...u,
        id: String(u.id || u._id),
      }));
      setActiveUsers(normalized);

      // Re-broadcast our own cursor so any user already in the room
      // (or who just refreshed) can see where we are immediately,
      // without waiting for us to move.
      const ed = editorRef.current;
      if (ed && !ed.isDestroyed) {
        const { from, to } = ed.state.selection;
        socketService.sendCursorPosition(documentId, { from, to });
      }
    };

    const handleUserJoined = ({ user: joinedUser }) => {
      if (!joinedUser) return;
      const normalized = {
        ...joinedUser,
        id: String(joinedUser.id || joinedUser._id),
      };
      setActiveUsers((prev) => {
        if (prev.some((u) => u.id === normalized.id)) return prev;
        return [...prev, normalized];
      });
      if (normalized.id !== getMyId()) {
        toast.success(`${normalized.name || "Someone"} joined`);
      }
    };

    const handleUserLeft = ({ userId }) => {
      const uid = String(userId);
      setActiveUsers((prev) => prev.filter((u) => u.id !== uid));
      setCursors((prev) => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
    };

    const handleCursorUpdate = ({ userId, position, user: cursorUser }) => {
      const uid = String(userId);
      setCursors((prev) => ({
        ...prev,
        [uid]: {
          position,
          user: cursorUser
            ? { ...cursorUser, id: String(cursorUser.id || cursorUser._id) }
            : prev[uid]?.user,
          color: getColorForUser(uid),
        },
      }));
    };

    const handleAuth = ({ success, message }) => {
      if (success) {
        socketService.joinDocument(documentId);
      } else {
        console.error("❌ Socket Authentication Failed:", message);
      }
    };

    // When a new user joins the room, the server asks all existing
    // clients to re-send their cursor so the newcomer can see them.
    const handleRequestCursorBroadcast = () => {
      const ed = editorRef.current;
      if (ed && !ed.isDestroyed) {
        const { from, to } = ed.state.selection;
        socketService.sendCursorPosition(documentId, { from, to });
      }
    };

    const onConnect = () => {
      if (token) socketService.emit("authenticate", token);
    };

    socketService.on("connect", onConnect);
    socketService.on("authenticated", handleAuth);
    socketService.on("load-document", handleLoadDocument);
    socketService.on("receive-changes", handleReceiveChanges);
    socketService.on("active-users", handleActiveUsers);
    socketService.on("user-joined", handleUserJoined);
    socketService.on("user-left", handleUserLeft);
    socketService.on("cursor-update", handleCursorUpdate);
    socketService.on("request-cursor-broadcast", handleRequestCursorBroadcast);

    if (socketService.socket?.connected) {
      onConnect();
    } else {
      socketService.connect();
    }

    return () => {
      socketService.leaveDocument(documentId);
      socketService.off("connect", onConnect);
      socketService.off("authenticated", handleAuth);
      socketService.off("load-document", handleLoadDocument);
      socketService.off("receive-changes", handleReceiveChanges);
      socketService.off("active-users", handleActiveUsers);
      socketService.off("user-joined", handleUserJoined);
      socketService.off("user-left", handleUserLeft);
      socketService.off("cursor-update", handleCursorUpdate);
      socketService.off("request-cursor-broadcast", handleRequestCursorBroadcast);
    };
  // Use user?.id (primitive) instead of `user` (object) so this effect
  // doesn't re-run just because AuthContext returned a new object reference
  // with the same data — which would cause a spurious leave+rejoin cycle.
  }, [documentId, getMyId, user?.id]);

  // Title change — ONLY the owner can rename; guard here prevents spurious 403 errors
  const handleTitleChange = async (title) => {
    if (!isOwner) return;
    try {
      await updateDocument.mutateAsync({ title });
      socketService.sendTitleChange(documentId, title);
    } catch (err) {
      console.error("Title change error:", err);
    }
  };

  const handleShareUpdate = (sharedWith) => {
    queryClient.setQueryData([QUERY_KEYS.DOCUMENT, documentId], (old) => {
      if (!old) return old;
      return { ...old, sharedWith };
    });
  };

  if (isLoading) return <Loading fullScreen />;
  if (error || !document)
    return (
      <div className="flex items-center justify-center min-h-screen dark:bg-gray-950">
        <p className="text-gray-600 dark:text-gray-400">Document not found</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <DocumentHeader
        document={document}
        onTitleChange={handleTitleChange}
        onShare={() => setShareModalOpen(true)}
        saving={saving || updateDocument.isPending}
        isOwner={isOwner}
        hasEditPermission={hasEditPermission}
      />

      <ActiveUsers users={activeUsers} cursors={cursors} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {!hasEditPermission && (
              <div className="mb-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                <span>👁</span>
                <span>
                  You have <strong>view-only</strong> access to this document.
                </span>
              </div>
            )}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 min-h-[600px] relative transition-colors">
              {editor && <EditorContent editor={editor} />}
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  Discussion
                </h3>
                <button
                  onClick={() => setShowComments(!showComments)}
                  className="text-primary-600 text-sm"
                >
                  {showComments ? "Hide" : "Show"}
                </button>
              </div>
              {showComments && <CommentSection documentId={documentId} />}
            </div>
          </div>
        </div>
      </div>

      {isOwner && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          document={document}
          onUpdate={handleShareUpdate}
        />
      )}
    </div>
  );
};

export default DocumentEditor;