/** Shows the ID of private channels and allows editing their names */
import type { RopePluginInit, RopePlugin } from "../api";

const defaultConfig: {
  privateChannelNames: Record<string, string>;
} = {
  privateChannelNames: {},
};

const init: RopePluginInit<typeof defaultConfig> = (api) => {
  const { SvgIcon, Tooltip } = api.slack;

  const unpatchBaseMrkdwnChannel = api.react.patchComponentWithTester2(api.slack.BaseMrkdwnChannel, props => props?.isNonExistent, BaseMrkdwnChannel => props => {
    const [text, setText] = api.usePluginConfig(
      (c) => c.privateChannelNames[props.id] ?? props.id,
      (c, t) => ({...c, privateChannelNames: {...c.privateChannelNames, [props.id]: t}}),
    );
    const [editValue, setEditValue] = globalThis.React.useState(null);

    function startEditing() {
      setEditValue(text);
    }

    function stopEditing() {
      const editValue2 = editValue.trim();
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

  return () => {
    unpatchBaseMrkdwnChannel();
  };
};

export default {
  id: "PrivateChannelMapper",
  meta: {
    name: "Private Channel Mapper",
    description: "Shows the ID of private channels and allows editing their names",
    authors: "<@U01D9DWGEB0>",
  },
  defaultConfig,
  init,
} satisfies RopePlugin<typeof defaultConfig>;

