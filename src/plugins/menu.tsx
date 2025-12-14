// Rope menu
import * as react from "jspatching/react";
import * as taut from "../taut";
import { Tabs, TabsItemData, Heading, FieldSet, Legend, Label, MrkdwnElement } from "../slack";

function TautCompatMenu() {
  const [plugins, setPlugins] = globalThis.React.useState<taut.TautPluginRegistration[]>([...taut.__tautPluginRegistry.values()]);

  function reloadPluginsList() {
    setPlugins([...taut.__tautPluginRegistry.values()]);
  }
  globalThis.React.useEffect(reloadPluginsList, [[...taut.__tautPluginRegistry.keys()]]);

  return <FieldSet id="taut-compat-for-rope">
    <Legend className="margin_bottom_100">Taut compat for Rope</Legend>
    {plugins.map(i => <div key={i.name}>
      <Label
        type="inline"
        text={<>{i.meta?.name ?? i.name}</>}
        subtext={i.meta ? <MrkdwnElement text={`${i.meta.description}\nAuthors: ${i.meta.authors}`} /> : null}
      >
        <input
          className="c-input_checkbox"
          type="checkbox"
          checked={i.config.enabled}
          onChange={e => {
            if (e.target.checked) {
              taut.registerStartTautPlugin(i.name);
            } else {
              taut.registerStopTautPlugin(i.name);
            }
            reloadPluginsList();
          }}
        />
      </Label>
    </div>)}
    <hr/>
    <MrkdwnElement text={`Plugin configurations are stored in \`localStorage\`.\nSome plugins may require a reload to properly take effect.\nThings are unstable and may break, your computer might even catch on fire. Please report any bugs!`} />
  </FieldSet>
}

function RopeMenu() {
  return <div>
    <TautCompatMenu />
    <hr />
    {/*<Heading>Test</Heading>*/}
    <>Some more text</>
    <hr/>
    <MrkdwnElement text={`Rope v__VERSION__, by <@U01D9DWGEB0>`} />
  </div>;
}

export default function init() {
  react.patchComponent2(Tabs, Tabs => (props) => {
    const [isTabSelected, setIsTabSelected] = globalThis.React.useState(false);

    const newTabItem = {
      id: "rope",
      label: <>Rope</>,
      content: <RopeMenu />,
      "aria-label": "rope",
      svgIcon: { name: "code" },
    } satisfies TabsItemData;
    let tabs = props.tabs;
    if (props?.className === "p-prefs_dialog__tabs" && props?.tabs?.length) {
      tabs = [...tabs, newTabItem];
    }

    const oldTabChange = props.onTabChange;
    const handleTabChange = globalThis.React.useCallback((id: string, e: React.UIEvent) => {
      if (id === newTabItem.id) {
        setIsTabSelected(true);
      } else {
        setIsTabSelected(false);
        if (oldTabChange)
          oldTabChange(id, e);
      }
    }, [oldTabChange]);

    const currentTabId = isTabSelected ? newTabItem.id : props.currentTabId;

    return <Tabs
      {...props}
      tabs={tabs}
      onTabChange={handleTabChange}
      currentTabId={currentTabId}
    />;
  });
}
