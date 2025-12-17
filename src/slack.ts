import * as webpack from "jspatching/webpack";
import * as react from "jspatching/react";
import * as redux from "jspatching/redux";

webpack._3type_hookWebpackChunkEarly("webpackChunkwebapp");
//redux.registerPrettyReduxMatcher("slack1", (r, s, e) => typeof s === "undefined");
//redux.registerPrettyReduxMatcher("slack2", (r, s, e) => typeof e === "undefined");
redux.registerPrettyReduxMatcher("slack", (r, s, e) => !!r && !!s && !!e);
//redux.insertReduxReducerPatch("slack", "logger", (s, a, r) => {
//  console.log("[Rope] slack reducer called with action", a);
//  return r(s, a);
//});
react.init();

/*
 * important fields for Redux action creators (functions):
 * description - what it does
 * getType() - returns the action .type, usually =description
 * isFetcherCreator - may be true
 * isThunkCreator - may be true
 * meta { description, key, name, usageCount } - meta info
 *
 * example:
 * description: "[Fetcher 886] Sends a message"
 * getType: ()=>n.description
 * isFetcherCreator: true
 * isThunkCreator: true
 * meta: {description: "Sends a message", key: "createFetcherChatPostMessage", name: "chatPostMessage", usageCount: 2}
 */

export const PlainText = react.virtualComponent<{
  id?: string;
  text: string;
  // parent
  // default true
  emoji?: boolean;
  emojiSize?: number;
  maxNewlines?: number;
  maxCharacters?: number;
  // onRender
  // default true
  noJumbomoji?: boolean;
  // className
  // default true
  showTooltips?: boolean;
  // default true
  noLinking?: true;
  // customLineEnding
  // default "bk-plain_text_element"
  dataQA?: string;
  noHighlights?: boolean;
  noHexColors?: boolean;
  noCode?: boolean;
  noQuotes?: boolean;
}>("PlainText");
export const MrkdwnElement = react.virtualComponent<{
  text: string;
  // parent
  maxNewlines?: number;
  maxCharacters?: number;
  // onRender
  // clogLinkClick
  // customFormatHandler
  // customLineEnding
  noJumbomoji?: boolean;
  noLinking?: boolean;
  // emojiDisplayInfo
  // blocksContainerContext
}>("MrkdwnElement");
export type TabsItemData = {
  // used in "Preferences"
  label: React.ReactElement;
  svgIcon?: React.ComponentProps<typeof SvgIcon>;
  id: string;
  content: React.ReactElement;
  "aria-label"?: string;
  "aria-labelledby"?: string;
} | {
  title?: React.ReactElement;
  "data-qa"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
  onClick?: () => void;
  renderWrapper?: () => void;
  buttonWrapper?: () => void;
  className?: string;
};
export const Tabs = react.virtualComponent<{
  tabs: TabsItemData[],
  className?: string;
  onTabChange?: (id: string, e: React.UIEvent) => void;
  currentTabId?: string;
}>("Tabs");
export const TypingNames = react.virtualComponent<{
  firstTyper: string;
  secondTyper?: string;
  severalPeopleAreTyping?: boolean;
}>("TypingNames");
export const Heading = react.virtualComponent<React.PropsWithChildren<{
  level?: number;
  size?: number;
  // defaults to black
  weight?: string;
}>>("Heading");
export const FieldSet = react.virtualComponent<React.PropsWithChildren<{
  id?: string;
  className?: string;
}>>("FieldSet");
export const Legend = react.virtualComponent<React.PropsWithChildren<{
  className?: string;
}>>("Legend");
export const SvgIcon = react.virtualComponent<{
  inline?: boolean;
  name:
  | "add-bot"
  | "add-branch"
  | "add-channel-canvas"
  | "add-channel-canvas-filled"
  | "add-comment"
  | "add-placeholder"
  | "add-reaction"
  | "agentforce"
  | "agentforce-filled"
  | "ai-agents"
  | "ai-agents-filled"
  | "ai-check"
  | "ai-file-summary"
  | "ai-huddle-summary"
  | "ai-huddle-summary-filled"
  | "ai-search"
  | "ai-sparkle"
  | "ai-sparkle-alt"
  | "ai-sparkle-alt-filled"
  | "ai-sparkle-filled"
  | "ai-summary"
  | "ai-summary-filled"
  | "ai-summary-off"
  | "ai-summary-off-filled"
  | "ai-thread-summary"
  | "ai-translate"
  | "ai-workflow"
  | "ai-workflow-filled"
  | "align-center"
  | "align-left"
  | "align-right"
  | "app-directory"
  | "app-directory-filled"
  | "apps"
  | "archive"
  | "archive-filled"
  | "arrow-bottom-left"
  | "arrow-bottom-right"
  | "arrow-collapse"
  | "arrow-down"
  | "arrow-down-left"
  | "arrow-down-right"
  | "arrow-expand"
  | "arrow-expand-full"
  | "arrow-left"
  | "arrow-right"
  | "arrow-right-channel"
  | "arrow-right-channel-filled"
  | "arrow-split"
  | "arrow-top-right"
  | "arrow-up"
  | "arrow-up-circle"
  | "arrow-up-circle-filled"
  | "arrow-up-left"
  | "arrow-up-right"
  | "attachment"
  | "backspace"
  | "bank"
  | "binary"
  | "blocks"
  | "blocks-filled"
  | "bluetooth"
  | "bluetooth-sound"
  | "bold"
  | "bolt"
  | "bolt-filled"
  | "book"
  | "bookmark"
  | "bookmark-filled"
  | "bot"
  | "branch"
  | "brand-1password"
  | "brand-adobe-ai-filled"
  | "brand-adobe-fl-filled"
  | "brand-adobe-id-filled"
  | "brand-adobe-ps-filled"
  | "brand-adobe-swf-filled"
  | "brand-android-filled"
  | "brand-apple-filled"
  | "brand-apple-intelligence"
  | "brand-asana"
  | "brand-box"
  | "brand-dropbox-filled"
  | "brand-dropbox-paper-filled"
  | "brand-facebook-filled"
  | "brand-facebook-messenger-filled"
  | "brand-figma-filled"
  | "brand-flickr-filled"
  | "brand-github-filled"
  | "brand-google-drive-filled"
  | "brand-google-filled"
  | "brand-google-hangouts-filled"
  | "brand-instagram-filled"
  | "brand-line-filled"
  | "brand-linkedin-filled"
  | "brand-lucid-chart-filled"
  | "brand-lucid-press-filled"
  | "brand-lucid-spark-filled"
  | "brand-markdown-filled"
  | "brand-microsoft-excel-filled"
  | "brand-microsoft-onedrive-filled"
  | "brand-microsoft-ppt-filled"
  | "brand-microsoft-word-filled"
  | "brand-miro-filled"
  | "brand-pinterest-filled"
  | "brand-pocket-casts-filled"
  | "brand-siriusxm-filled"
  | "brand-sketch-filled"
  | "brand-skype-filled"
  | "brand-soundcloud-filled"
  | "brand-spaces"
  | "brand-spotify"
  | "brand-stitcher-filled"
  | "brand-tiktok-filled"
  | "brand-tripit-filled"
  | "brand-webex-filled"
  | "brand-windows-filled"
  | "brand-x-filled"
  | "brand-youtube-filled"
  | "brand-zoho-filled"
  | "brand-zoom-filled"
  | "bug"
  | "bug-filled"
  | "building"
  | "buildings"
  | "buildings-filled"
  | "bulleted-list"
  | "calculator"
  | "calculator-filled"
  | "calendar"
  | "calendar-filled"
  | "call"
  | "call-declined"
  | "call-down"
  | "call-filled"
  | "call-handset"
  | "call-missed"
  | "call-missed-filled"
  | "callout"
  | "callout-filled"
  | "camera"
  | "camera-filled"
  | "camera-photo"
  | "camera-photo-filled"
  | "camera-swap-filled"
  | "canvas"
  | "canvas-browser"
  | "canvas-browser-filled"
  | "canvas-content"
  | "canvas-content-filled"
  | "canvas-filled"
  | "caret-down"
  | "caret-down-filled"
  | "caret-down-full"
  | "caret-dropdown"
  | "caret-dropdown-filled"
  | "caret-left"
  | "caret-left-double-full"
  | "caret-left-filled"
  | "caret-left-full"
  | "caret-right"
  | "caret-right-double-full"
  | "caret-right-filled"
  | "caret-right-full"
  | "caret-up"
  | "caret-up-down"
  | "caret-up-filled"
  | "caret-up-full"
  | "cart"
  | "channel"
  | "channel-add"
  | "channel-arrow-left"
  | "channel-arrow-right"
  | "channel-disconnected"
  | "channel-filled"
  | "channel-search"
  | "channel-search-filled"
  | "check"
  | "check-add"
  | "check-circle"
  | "check-circle-filled"
  | "check-filled"
  | "check-list"
  | "checkbox"
  | "checkbox-filled"
  | "clear"
  | "clock"
  | "clock-filled"
  | "close"
  | "close-circle"
  | "close-circle-filled"
  | "close-filled"
  | "closed-caption"
  | "closed-caption-filled"
  | "cloud-offline"
  | "cloud-offline-filled"
  | "cloud-upload"
  | "code"
  | "code-block"
  | "cogs"
  | "column-three"
  | "column-two"
  | "command"
  | "comment"
  | "comment-filled"
  | "comments"
  | "comments-filled"
  | "compose"
  | "copy"
  | "copy-filled"
  | "credit-card"
  | "css"
  | "currency"
  | "database"
  | "desktop-notification"
  | "desktop-notification-filled"
  | "direct-messages"
  | "direct-messages-filled"
  | "disable"
  | "disc-image"
  | "divider"
  | "document"
  | "download"
  | "draw-others"
  | "draw-others-off"
  | "edit"
  | "edit-filled"
  | "einstein-alt-filled"
  | "einstein-filled"
  | "ellipsis-horizontal-filled"
  | "ellipsis-vertical-filled"
  | "email"
  | "email-down"
  | "email-filled"
  | "email-invite"
  | "email-reply"
  | "email-up"
  | "emoji"
  | "emoji-activities"
  | "emoji-celebration"
  | "emoji-filled"
  | "emoji-flag"
  | "emoji-flag-filled"
  | "emoji-food"
  | "emoji-missing-filled"
  | "emoji-nature"
  | "emoji-objects"
  | "emoji-objects-filled"
  | "emoji-symbols"
  | "emoji-travel"
  | "enter"
  | "eraser"
  | "eraser-filled"
  | "expand-diagonal"
  | "explore"
  | "explore-filled"
  | "eye-closed"
  | "eye-open"
  | "eye-open-filled"
  | "fast-forward"
  | "fast-forward-filled"
  | "file"
  | "file-adobe-flash"
  | "file-browser"
  | "file-browser-filled"
  | "file-cad"
  | "file-download"
  | "file-filled"
  | "file-indesign"
  | "file-input"
  | "file-input-filled"
  | "file-powerpoint"
  | "file-qtz"
  | "file-upload"
  | "file-vector"
  | "files"
  | "files-filled"
  | "filters"
  | "flag"
  | "flag-filled"
  | "folder"
  | "folder-filled"
  | "folder-open"
  | "folder-open-filled"
  | "form"
  | "form-filled"
  | "formatting"
  | "forward-fifteen"
  | "gauge"
  | "gauge-filled"
  | "gif"
  | "gif-wink"
  | "glasses"
  | "glasses-filled"
  | "globe"
  | "govslack"
  | "govslack-filled"
  | "govslack-off"
  | "govslack-off-filled"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "headphones"
  | "headphones-filled"
  | "heart"
  | "heart-filled"
  | "help"
  | "help-filled"
  | "hierarchy"
  | "hierarchy-filled"
  | "highlight-color"
  | "history"
  | "home"
  | "home-filled"
  | "hourglass"
  | "hourglass-empty"
  | "hourglass-filled"
  | "icon-placeholder"
  | "icon-placeholder-filled"
  | "image"
  | "image-filled"
  | "image-input"
  | "image-input-filled"
  | "inactive"
  | "inactive-filled"
  | "inbox"
  | "inbox-filled"
  | "indent-left"
  | "indent-right"
  | "info"
  | "info-filled"
  | "internal-slackbot-status-filled"
  | "internal-status-guest"
  | "internal-status-guest-dnd"
  | "internal-status-member"
  | "internal-status-member-dnd"
  | "internal-status-single-channel-guest"
  | "internal-status-single-channel-guest-dnd"
  | "invoice"
  | "invoice-filled"
  | "italic"
  | "kanban"
  | "key"
  | "key-filled"
  | "keyboard"
  | "keyboard-down"
  | "keyboard-down-filled"
  | "keyboard-filled"
  | "laptop"
  | "laptop-filled"
  | "left-click"
  | "life-ring"
  | "life-ring-filled"
  | "link"
  | "list-item"
  | "list-item-filled"
  | "list-view"
  | "lists"
  | "lists-filled"
  | "location"
  | "location-filled"
  | "lock"
  | "lock-filled"
  | "magic-wand"
  | "magic-wand-filled"
  | "map"
  | "mark-as-read"
  | "mark-as-read-filled"
  | "mark-as-unread"
  | "mark-as-unread-filled"
  | "media-archive"
  | "megaphone"
  | "megaphone-filled"
  | "mentions"
  | "mentions-filled"
  | "menu"
  | "message"
  | "message-filled"
  | "message-notification"
  | "microphone"
  | "microphone-filled"
  | "microphone-off"
  | "microphone-off-filled"
  | "minus"
  | "minus-filled"
  | "mobile"
  | "mobile-filled"
  | "mobile-notification"
  | "mobile-notification-filled"
  | "moon"
  | "moon-filled"
  | "move-to-main-window"
  | "move-to-split-view"
  | "multiparty-dm-10-filled"
  | "multiparty-dm-11-filled"
  | "multiparty-dm-12-filled"
  | "multiparty-dm-13-filled"
  | "multiparty-dm-14-filled"
  | "multiparty-dm-15-filled"
  | "multiparty-dm-2-filled"
  | "multiparty-dm-3-filled"
  | "multiparty-dm-4-filled"
  | "multiparty-dm-5-filled"
  | "multiparty-dm-6-filled"
  | "multiparty-dm-7-filled"
  | "multiparty-dm-8-filled"
  | "multiparty-dm-9-filled"
  | "music"
  | "mute-agent"
  | "navigation-tabs-horizontal"
  | "navigation-tabs-horizontal-filled"
  | "navigation-tabs-vertical"
  | "navigation-tabs-vertical-filled"
  | "network"
  | "network-test1"
  | "new-window"
  | "next"
  | "next-filled"
  | "notifications"
  | "notifications-all-new-posts"
  | "notifications-check"
  | "notifications-dnd"
  | "notifications-dnd-filled"
  | "notifications-filled"
  | "notifications-just-mentions"
  | "notifications-off"
  | "notifications-off-filled"
  | "number"
  | "numbered-list"
  | "open-in-canvas"
  | "open-in-main-view"
  | "open-in-tab"
  | "open-in-window"
  | "org-shared-channel"
  | "paintbrush"
  | "paintbrush-filled"
  | "paper-plane"
  | "paper-plane-filled"
  | "paragraph"
  | "pause"
  | "pause-filled"
  | "pdf-file"
  | "pdf-file-filled"
  | "percent"
  | "php"
  | "pin"
  | "pin-filled"
  | "play"
  | "play-filled"
  | "plug"
  | "plug-filled"
  | "plus"
  | "plus-filled"
  | "poop"
  | "poop-filled"
  | "pop-into-slack"
  | "posts"
  | "posts-filled"
  | "power-off"
  | "presentation"
  | "previous"
  | "previous-filled"
  | "print"
  | "priority"
  | "priority-dismiss"
  | "priority-dismiss-filled"
  | "priority-filled"
  | "quick-switch"
  | "quip"
  | "quote"
  | "quote-post"
  | "radio-button"
  | "radio-button-filled"
  | "reaction"
  | "reaction-filled"
  | "reduce-diagonal"
  | "reduce-full"
  | "reference"
  | "refine"
  | "refresh"
  | "remind"
  | "reminder"
  | "reorder"
  | "rewind"
  | "rewind-fifteen"
  | "rewind-filled"
  | "right-click"
  | "rocket"
  | "rotate"
  | "sales"
  | "sales-filled"
  | "sales-opportunity-list"
  | "save"
  | "schedule-send"
  | "screen"
  | "screen-off"
  | "screen-share"
  | "screen-share-collab-off"
  | "screen-share-collab-on"
  | "search"
  | "search-files"
  | "search-filled"
  | "section"
  | "section-filled"
  | "security"
  | "security-filled"
  | "send"
  | "send-filled"
  | "send-to-list"
  | "settings"
  | "settings-filled"
  | "sf-account"
  | "sf-account-filled"
  | "sf-case"
  | "sf-case-filled"
  | "sf-cloud"
  | "sf-cloud-check"
  | "sf-cloud-check-filled"
  | "sf-cloud-error"
  | "sf-cloud-error-filled"
  | "sf-cloud-filled"
  | "sf-cloud-sync"
  | "sf-cloud-sync-filled"
  | "sf-contact"
  | "sf-contact-filled"
  | "sf-lead"
  | "sf-lead-filled"
  | "sf-opportunity"
  | "sf-opportunity-filled"
  | "sf-record"
  | "sf-record-filled"
  | "sf-record-list"
  | "sf-record-list-filled"
  | "sf-search"
  | "share"
  | "share-android"
  | "share-feedback"
  | "share-message"
  | "share-message-filled"
  | "shared-channel"
  | "shared-channel-filled"
  | "shared-channel-pending"
  | "shift"
  | "shuffle"
  | "sidebar"
  | "sidebar-filled"
  | "sidebar-left"
  | "sidebar-left-filled"
  | "sign-out"
  | "slack-ai"
  | "slack-ai-filled"
  | "slack-ai-off"
  | "slack-ai-off-filled"
  | "slack-logo"
  | "slack-logo-color"
  | "slash"
  | "slash-box"
  | "sort"
  | "sound"
  | "sound-down"
  | "sound-down-filled"
  | "sound-filled"
  | "sound-medium"
  | "sound-medium-filled"
  | "sound-off"
  | "sound-off-filled"
  | "sound-up"
  | "sound-up-filled"
  | "spaces"
  | "sparkles"
  | "sparkles-filled"
  | "spiral"
  | "spreadsheet"
  | "square"
  | "stacked-cards"
  | "stacked-cards-filled"
  | "star"
  | "star-filled"
  | "status-guest"
  | "status-guest-dnd"
  | "status-guest-dnd-filled"
  | "status-guest-filled"
  | "status-member"
  | "status-member-dnd"
  | "status-member-dnd-filled"
  | "status-member-filled"
  | "status-mobile-dnd"
  | "status-single-channel-guest"
  | "status-single-channel-guest-dnd"
  | "status-single-channel-guest-dnd-filled"
  | "status-single-channel-guest-filled"
  | "status-slackbot"
  | "status-slackbot-filled"
  | "stream"
  | "strikethrough"
  | "subtask"
  | "subtask-complete"
  | "subtask-progress"
  | "sun"
  | "sun-filled"
  | "surface"
  | "table"
  | "tablet"
  | "tablet-filled"
  | "tag"
  | "tag-filled"
  | "terminal"
  | "text"
  | "text-color"
  | "text-cursor"
  | "text-snippet"
  | "threads"
  | "threads-filled"
  | "three-d-graphic"
  | "thumbs-down"
  | "thumbs-down-filled"
  | "thumbs-up"
  | "thumbs-up-filled"
  | "ticket"
  | "ticket-filled"
  | "tools"
  | "tools-filled"
  | "trash"
  | "trash-filled"
  | "unarchive"
  | "unarchive-filled"
  | "underline"
  | "undo"
  | "unlock"
  | "unlock-filled"
  | "unstar"
  | "unstar-filled"
  | "user"
  | "user-add"
  | "user-add-filled"
  | "user-directory"
  | "user-directory-add"
  | "user-directory-filled"
  | "user-filled"
  | "user-group-add"
  | "user-groups"
  | "user-groups-filled"
  | "user-hide"
  | "user-hide-filled"
  | "user-status"
  | "verified"
  | "verified-filled"
  | "video"
  | "video-filled"
  | "video-off"
  | "video-off-filled"
  | "vip"
  | "vip-filled"
  | "warning"
  | "warning-filled"
  | "webhook"
  | "window-contract"
  | "window-contract-filled"
  | "window-expand"
  | "window-expand-filled"
  | "window-gradient"
  | "workspace"
  | "workspace-filled"
  | "wrench"
  | "wrench-filled"
  | "you"
  | "you-filled"
  | "zip"
  | "zoom-in"
  | "zoom-out";
}>("SvgIcon");
export const Label = react.virtualComponent<React.PropsWithChildren<{
  cursor?: "pointer";
  htmlFor?: string;
  className?: string;
  // default true
  optional?: boolean;
  subtext?: string;
  text?: string;
  // default block
  type?: "block" | "inline";
  // default false
  isDisabled?: boolean;
  // default true
  dataQaLabel?: true;
}>>("Label");
export const Tooltip = react.virtualComponent<React.PropsWithChildren<{
  delay: number;
  // default false(?)
  hideFromScreenReader?: boolean;
  tip: () => React.ReactNode;
}>>("Tooltip");
export const BaseMrkdwnChannel = react.virtualComponent<{
  alwaysDisplayAsLink?: boolean;
  channelHasNonUniqueName?: boolean;
  channelName?: string;
  clogLinkClick?: () => void;
  id: string;
  isChannelImOrMpim: boolean;
  isFromAnotherTeam: boolean;
  isMember: boolean;
  isNonExistent: boolean;
  isPrivate: boolean;
  isRecord: boolean;
  isUnknown: boolean;
  maybeOpenInSurfaceOrNavigate?: () => void;
  mpimMemberNames?: string[];
  noLinking?: boolean;
  team?: string;
  teamName?: string;
}>("BaseMrkdwnChannel");
export const MemberProfileRestriction = react.virtualComponent<{
  className?: string;
  /* TODO: add types */
  member: any;
  team: any;
}>("MemberProfileRestriction");

const cs = {
  PlainText,
  MrkdwnElement,
  Tabs,
  TypingNames,
  Heading,
  FieldSet,
  Legend,
  SvgIcon,
  Label,
  Tooltip,
  BaseMrkdwnChannel,
};

globalThis.$components = {};
for (const [k, v] of Object.entries(cs)) {
  globalThis.$components[k] = v;
}
