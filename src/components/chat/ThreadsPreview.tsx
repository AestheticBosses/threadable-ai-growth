import { Heart, MessageCircle, Repeat2, Share } from "lucide-react";

interface ThreadsPreviewProps {
  content: string;
  displayName: string;
  username: string;
  profilePicUrl?: string | null;
  isEditing: boolean;
  onContentChange: (content: string) => void;
}

export function ThreadsPreview({
  content,
  displayName,
  username,
  profilePicUrl,
  isEditing,
  onContentChange,
}: ThreadsPreviewProps) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#101010" }}>
      {/* Post header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        {profilePicUrl ? (
          <img src={profilePicUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-[#333] flex items-center justify-center">
            <span className="text-white text-sm font-semibold">{displayName?.charAt(0) || "?"}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{displayName || "User"}</p>
          <p className="text-xs text-[#777]">@{username || "user"} · Just now</p>
        </div>
      </div>

      {/* Post content */}
      <div className="px-4 pb-3">
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            className="w-full bg-transparent text-white text-sm leading-relaxed resize-none focus:outline-none min-h-[120px]"
            autoFocus
          />
        ) : (
          <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{content}</p>
        )}
      </div>

      {/* Action bar */}
      <div className="px-4 pb-4 flex items-center gap-6 text-[#777]">
        <Heart className="h-5 w-5" />
        <MessageCircle className="h-5 w-5" />
        <Repeat2 className="h-5 w-5" />
        <Share className="h-5 w-5" />
      </div>
    </div>
  );
}
