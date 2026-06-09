/** Allows typing notifications to be silenced */
import { WebpackImported } from "jspatching/webpack";
import { wirePlugin } from "../plugins";
import {
  InputContainer as InputContainerI,
  MessagePaneInput as MessagePaneInputI,
  SvgIcon as SvgIconI,
  Tooltip as TooltipI,
  IconButtonBase as IconButtonBaseI,
  TextyButtons as TextyButtonsI,
} from "../slack";

export default wirePlugin({
  SvgIconI,
  TooltipI,
  IconButtonBaseI,
}, {
  silenceTyping: false,
} as {
  silenceTyping: boolean;
}, {
  id: "SilentTyping",
  meta: {
    name: "Silent Typing",
    description: "Prevents other users from seeing that you are typing",
    authors: "<@U01D9DWGEB0>, inspired by <@U080A3QP42C>, <@U06UYA5GMB5>"
  },
  init(api, { SvgIconI, TooltipI, IconButtonBaseI }, _config) {
    return {
      modules: [],
      components: [{
        componentName: "MessagePaneInput",
        debugName: "silenttyping-messagepaneinput-patch",
        patch: (_require, React, MessagePaneInput: WebpackImported<typeof MessagePaneInputI>) => {
          const PatchedMessagePaneInput = api.react.patchedComponent(MessagePaneInput, props => {
            const [typingSilenced, ] = api.usePluginConfig(React, c => c.silenceTyping);

            if (typingSilenced) {
              props = {
                ...props,
                currentUserEndedTyping: () => {},
                currentUserStartedTyping: () => {}
              };
            }

            return <MessagePaneInput {...props} />;
          });

          return PatchedMessagePaneInput;
        },
      }, {
        componentName: "InputContainer",
        debugName: "silenttyping-inputcontainer-patch",
        patch: (_require, React, InputContainer: WebpackImported<typeof InputContainerI>) => {
          const PatchedInputContainer = api.react.patchedComponent(InputContainer, props => {
            const [typingSilenced, ] = api.usePluginConfig(React, c => c.silenceTyping);

            if (typingSilenced) {
              props = {
                ...props,
                currentUserEndedTyping: () => {},
                currentUserStartedTyping: () => {}
              };
            }

            return <InputContainer {...props} />;
          });

          return PatchedInputContainer;
        },
      }, {
        componentName: "TextyButtons",
        debugName: "silenttyping-textybuttons-patch",
        dependencies: [SvgIconI, TooltipI, IconButtonBaseI],
        patch: (require, React, TextyButtons: WebpackImported<typeof TextyButtonsI>) => {
          const SvgIcon = api.webpack.requireWebpackExport(require, SvgIconI)!;
          const Tooltip = api.webpack.requireWebpackExport(require, TooltipI)!;
          const IconButtonBase = api.webpack.requireWebpackExport(require, IconButtonBaseI)!;

          const PatchedTextyButtons = api.react.patchedComponent(TextyButtons, props => {
            const [silenceTyping, setSilenceTyping] = api.usePluginConfig(React,
              c => c.silenceTyping,
              (c, t) => ({ ...c, silenceTyping: t }),
            );

            const label = silenceTyping
              ? "Allow typing notifications"
              : "Suppress typing notifications";

            return <div style={{display: "flex"}}>
              <TextyButtons {...props} />
              <span style={{marginLeft: "auto"}}>
                <Tooltip
                  tip={label}
                  position="top"
                  offsetY={-7}
                  delay={500}
                  zIndex="above_fs"
                >
                  <IconButtonBase
                    aria-pressed={String(silenceTyping)}
                    aria-label={label}
                    onClick={() => setSilenceTyping(!silenceTyping)}
                    tabIndex={-1}
                    size="smedium">
                    <SvgIcon name={silenceTyping ? "notifications-off" : "notifications"} size={18} />
                  </IconButtonBase>
                </Tooltip>
              </span>
            </div>;
          });

          return PatchedTextyButtons;
        },
      }],
    };
  }
});
