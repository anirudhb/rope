/** Shows the ID of private channels and allows editing their names */
import { WebpackImported } from "jspatching/webpack";
import { wirePlugin } from "../plugins";
import {
  SvgIcon as SvgIconI,
  Tooltip as TooltipI,
  BaseMrkdwnChannel as BaseMrkdwnChannelI,
} from "../slack";
import { ReactMatcher } from "jspatching/react";

export default wirePlugin({
  ReactI: ReactMatcher,
  SvgIconI,
  TooltipI,
  BaseMrkdwnChannelI,
}, {
  id: "PrivateChannelMapper",
  meta: {
    name: "Private Channel Mapper",
    description: "Shows the ID of private channels and allows editing their names",
    authors: "<@U01D9DWGEB0>",
  },
  defaultConfig: {
    privateChannelNames: {},
  } satisfies {
    privateChannelNames: Record<string, string>;
  },
  init(api, { ReactI, SvgIconI, TooltipI, BaseMrkdwnChannelI }, _config) {
    return [{
      exportId: BaseMrkdwnChannelI,
      debugName: "privatechannelmapper-basemrkdwnchannel-patch",
      dependencies: [ReactI, SvgIconI, TooltipI],
      patch: (require, BaseMrkdwnChannel: WebpackImported<typeof BaseMrkdwnChannelI>) => {
        const React = api.webpack.requireWebpackExport(require, ReactI)!;
        const SvgIcon = api.webpack.requireWebpackExport(require, SvgIconI)!;
        const Tooltip = api.webpack.requireWebpackExport(require, TooltipI)!;

        const PatchedBaseMrkdwnChannel = api.react.patchedComponent(BaseMrkdwnChannel, props => {
          console.log(props);
          if (!props.isNonExistent)
            return <BaseMrkdwnChannel {...props} />;

          const [text, setText] = api.usePluginConfig(
            React,
            (c: any) => c.privateChannelNames[props.id] ?? props.id,
            (c: any, t) => ({...c, privateChannelNames: {...c.privateChannelNames, [props.id]: t}}),
          );
          const [editValue, setEditValue] = React.useState<string | null>(null);

          function startEditing() {
            setEditValue(text);
          }

          function stopEditing() {
            const editValue2 = editValue!.trim();
            if (editValue2 === "") {
              setText(props.id);
            } else {
              setText(editValue2);
            }
            setEditValue(null);
          }

          const inner = <span className="c-missing_channel--private" onDoubleClick={startEditing}>
            <SvgIcon inline={true} name="lock" />
            {editValue !== null
              ? <input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyUp={e => e.key === "Enter" && stopEditing()}
                  onBlur={stopEditing}
                />
              : text}
          </span>;

          if (text === props.id)
            return inner;
          else
            return <Tooltip
              delay={300}
              tip={() => <>{props.id}</>}
            >
              {inner}
            </Tooltip>;
        });

        return PatchedBaseMrkdwnChannel;
      },
    }];
  },
});

