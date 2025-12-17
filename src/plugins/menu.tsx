// Rope menu
import * as plugins from "../plugins";
import type { RopeAPI } from "../api";
import { Tabs, TabsItemData, Heading, FieldSet, Legend, Label, MrkdwnElement } from "../slack";

function PluginsList() {
  const [plugins_, setPlugins_] = globalThis.React.useState<plugins.RopePluginRegistration[]>([...plugins.__ropePluginRegistry.values()]);

  function reloadPluginsList() {
    setPlugins_([...plugins.__ropePluginRegistry.values()]);
  }
  globalThis.React.useEffect(reloadPluginsList, [[...plugins.__ropePluginRegistry.keys()]]);

  return <FieldSet id="rope-plugins-list">
    <Legend className="margin_bottom_100">Rope plugins</Legend>
    {plugins_.map(i => <div key={i.plugin.id}>
      <Label
        type="inline"
        text={<>{i.plugin.meta.name}</>}
        subtext={<MrkdwnElement text={`${i.plugin.meta.description}\nAuthors: ${i.plugin.meta.authors}`} />}
      >
        <input
          className="c-input_checkbox"
          type="checkbox"
          checked={plugins.getRopePluginEnabled(i.plugin.id)}
          onChange={e => {
            plugins.setRopePluginEnabled(i.plugin.id, e.target.checked);
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
    <PluginsList />
    <hr />
    {/*<Heading>Test</Heading>*/}
    <>Some more text</>
    <hr/>
    <MrkdwnElement text={`Rope v__VERSION__, by <@U01D9DWGEB0>`} />
  </div>;
}

function init(api: RopeAPI) {
  const unpatchTabs = api.react.patchComponentWithTester2(
    Tabs,
    (props) => props?.className === "p-prefs_dialog__tabs" && props?.tabs?.length > 0,
    Tabs => (props) => {
      const [isTabSelected, setIsTabSelected] = globalThis.React.useState(false);

      const newTabItem = {
        id: "rope",
        label: <>Rope</>,
        content: <RopeMenu />,
        "aria-label": "rope",
        svgIcon: { name: "code" },
      } satisfies TabsItemData;
      let tabs = [...props.tabs, newTabItem];

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
    },
  );

  return () => {
    unpatchTabs();
  };
}

export default {
  id: "menu",
  meta: {
    name: "Rope menu",
    description: "Provides a menu to configure and view Rope",
    authors: "<@U01D9DWGEB0>",
  },
  init,
} satisfies plugins.RopePlugin;
