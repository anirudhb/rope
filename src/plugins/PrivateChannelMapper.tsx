/** Shows the ID of private channels and allows editing their names */
import { WebpackImported } from "jspatching/webpack";
import { wirePlugin } from "../plugins";
import {
  SvgIcon as SvgIconI,
  Tooltip as TooltipI,
  BaseMrkdwnChannel as BaseMrkdwnChannelI,
} from "../slack";

export default wirePlugin({
  SvgIconI,
  TooltipI,
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
  init(api, { SvgIconI, TooltipI, extraModules: { menuConfigUi }, }, _config) {
    return {
      modules: [{
        exportId: menuConfigUi,
        debugName: "privatechannelmapper-menuconfigui",
        patch: (_require, orig, _module, _exports) => {
          return {
            ...orig,
            PrivateChannelMapper: (React: typeof import("react")) => {
              return function PrivateChannelMapperConfigUi() {
                return <div>This is config for PrivateChannelMapper!</div>;
              };
            },
          };
        },
      }],
      components: [{
        componentName: "BaseMrkdwnChannel",
        debugName: "privatechannelmapper-basemrkdwnchannel-patch",
        dependencies: [SvgIconI, TooltipI],
        patch: (require, React, BaseMrkdwnChannel: WebpackImported<typeof BaseMrkdwnChannelI>) => {
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
      }],
    };
  },
});

