/** Shows the ID of private channels and allows editing their names */
import { WebpackImported } from "jspatching/webpack";
import { wirePlugin } from "../plugins";
import {
  SvgIcon as SvgIconI,
  Tooltip as TooltipI,
  BaseMrkdwnChannel as BaseMrkdwnChannelI,
  Label as LabelI,
  Legend as LegendI,
  MrkdwnElement as MrkdwnElementI,
} from "../slack";

type PrivateChannelDbProvider = "jmeow" | "sahil" | null;

let lastFetchTimes = {};
let pendingFetches = {};

// Debounces calls to fetch a private channel's name.
// The given callback is only called if the debounce period is met.
function debouncedFetchPrivateChannelName(id: string, provider: PrivateChannelDbProvider, cb: (name: string) => void) {
  if (provider === null) {
    return;
  }

  let lastFetch = lastFetchTimes[id] ?? 0;
  const n = Date.now();
  if ((n - lastFetch) <= /* 5 minutes */ 1000*60*5) {
    return;
  }
  lastFetchTimes[id] = n;

  let p = pendingFetches[id];
  if (!p) {
    p = pendingFetches[id] = (async function() {
      if (provider === "jmeow") {
        const r = await fetch(`https://slackprivatechannels.jmeow.net/channel/${id}`);
        const j = await r.json();
        if (j.success && j.confirmed) {
          return {
            ok: true,
            name: j.name + (j.notes ? ` (${j.notes})` : ""),
          };
        } else {
          return { ok: false };
        }
      } else if (provider === "sahil") {
        const r = await fetch(`https://flaron.halceon.dev/channel/${id}`);
        const j = await r.json();
        if (j.name) {
          return {
            ok: true,
            name: j.name,
          };
        } else {
          return { ok: false };
        }
      } else {
        return { ok: false };
      }
    })();
  }

  p.then((res: any) => {
    if (res.ok) {
      cb(res.name);
    }
  });
}

export default wirePlugin({
  SvgIconI,
  TooltipI,
  LabelI,
  LegendI,
  MrkdwnElementI,
}, {
  privateChannelNames: {},
  provider: null,
} as {
  privateChannelNames: Record<string, string>;
  provider: PrivateChannelDbProvider;
}, {
  id: "PrivateChannelMapper",
  meta: {
    name: "Private Channel Mapper",
    description: "Shows the ID of private channels and allows editing their names",
    authors: "<@U01D9DWGEB0>",
  },
  init(api, { SvgIconI, TooltipI, LabelI, LegendI, MrkdwnElementI, extraModules: { menuConfigUi }, }, config) {
    return {
      modules: [{
        exportId: menuConfigUi,
        debugName: "privatechannelmapper-menuconfigui",
        dependencies: [LabelI, LegendI, MrkdwnElementI],
        patch: (require, orig, _module, _exports) => {
          return {
            ...orig,
            PrivateChannelMapper: (React: typeof import("react")) => {
              const Label = api.webpack.requireWebpackExport(require, LabelI);
              const Legend = api.webpack.requireWebpackExport(require, LegendI);
              const MrkdwnElement = api.webpack.requireWebpackExport(require, MrkdwnElementI);

              return function PrivateChannelMapperConfigUi() {
                const [provider, setProvider] = api.usePluginConfig(React,
                  c => c.provider ?? null,
                  (c, t) => ({ ...c, provider: t }),
                );

                function onProviderChange(e: React.ChangeEvent<HTMLInputElement>) {
                  const p = e.target.value === "null" ? null : e.target.value;
                  setProvider(p as any);
                }

                return <div>
                  <Legend>Private channel database provider</Legend>
                  <Label
                    type="inline"
                    text={<>No provider</>}
                  >
                    <input
                      className="c-input_radio"
                      type="radio"
                      name="privatechannelmapper-privatechanneldatabaseprovider"
                      checked={provider === null}
                      value="null"
                      onChange={onProviderChange} />
                  </Label>
                  <Label
                    type="inline"
                    text={<>jmeow</>}
                    subtext={<MrkdwnElement text="Using <@U091XKGS8SF>'s API, more info: <#C0AJU2MKHPZ>" />}
                  >
                    <input
                      className="c-input_radio"
                      type="radio"
                      name="privatechannelmapper-privatechanneldatabaseprovider"
                      checked={provider === "jmeow"}
                      value="jmeow"
                      onChange={onProviderChange} />
                  </Label>
                  <Label
                    type="inline"
                    text={<>sahil</>}
                    subtext={<MrkdwnElement text="Using <@U08PUHSMW4V>'s API: https://flaron.halceon.dev" />}
                  >
                    <input
                      className="c-input_radio"
                      type="radio"
                      name="privatechannelmapper-privatechanneldatabaseprovider"
                      checked={provider === "sahil"}
                      value="sahil"
                      onChange={onProviderChange} />
                  </Label>
                </div>;
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
            if (!props.isNonExistent)
              return <BaseMrkdwnChannel {...props} />;

            const [text, setText] = api.usePluginConfig(
              React,
              (c: any) => c.privateChannelNames[props.id] ?? props.id,
              (c: any, t) => ({...c, privateChannelNames: {...c.privateChannelNames, [props.id]: t === props.id ? undefined : t}}),
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

            React.useEffect(() => {
              if (text === props.id) {
                debouncedFetchPrivateChannelName(props.id, config.provider, name => {
                  if (editValue) {
                    // Don't drop user edits
                    return;
                  }
                  api.setPluginConfig(c => ({...c, privateChannelNames: {...c.privateChannelNames, [props.id]: name}}));
                });
              }
            }, []);

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

