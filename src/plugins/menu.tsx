// Rope menu
import * as plugins from "../plugins";
import {
  Tabs as TabsI,
  TabsItemData,
  FieldSet as FieldSetI,
  Legend as LegendI,
  Label as LabelI,
  MrkdwnElement as MrkdwnElementI,
  TabsWithWindowRef as TabsWithWindowRefI,
} from "../slack";
import { ReactMatcher } from "jspatching/react";
import { WebpackImported } from "jspatching/webpack";

export default plugins.wirePlugin({
  ReactI: ReactMatcher,
  //TabsI: (x) => true,
  TabsWithWindowRefI,
  FieldSetI,
  LegendI,
  LabelI,
  MrkdwnElementI,
}, {
  id: "menu",
  meta: {
    name: "Rope menu",
    description: "Provides a menu to configure and view Rope",
    authors: "<@U01D9DWGEB0>",
  },
  init(api, { ReactI, TabsWithWindowRefI, FieldSetI, LegendI, LabelI, MrkdwnElementI }) {
    return [/*{
      debugName: "rope-menu-createelement-patch",
      exportId: { ...ReactI, export: "createElement" },
      patch: (require, createElementOrig) => {
        return function(...args) {
          if (args[0] && api.react.getComponentName(args[0]) === "Tabs" && args[1] && args[1]?.className === "p-prefs_dialog__tabs") {
            debugger;
          }
          return createElementOrig(...args);
        };
      },
      }, */{
      debugName: "rope-menu-tabs-patch",
      exportId: TabsWithWindowRefI,
      patch: (require, Tabs: WebpackImported<typeof TabsWithWindowRefI>) => {
        const React = api.webpack.requireWebpackExport(require, ReactI);
        const MrkdwnElement = api.webpack.requireWebpackExport(require, MrkdwnElementI);
        const FieldSet = api.webpack.requireWebpackExport(require, FieldSetI);
        const Legend = api.webpack.requireWebpackExport(require, LegendI);
        const Label = api.webpack.requireWebpackExport(require, LabelI);

        function PluginsList() {
          const [plugins_, setPlugins_] = React.useState<plugins.RopePlugin[]>([...plugins.__ropePluginRegistry.values()]);

          function reloadPluginsList() {
            setPlugins_([...plugins.__ropePluginRegistry.values()]);
          }
          globalThis.React.useEffect(reloadPluginsList, [[...plugins.__ropePluginRegistry.keys()]]);

          return <FieldSet id="rope-plugins-list">
            <Legend className="margin_bottom_100">Rope plugins</Legend>
            {plugins_.map(i => <div key={i.id}>
              <Label
                type="inline"
                text={<>{i.meta.name}</>}
                subtext={<MrkdwnElement text={`${i.meta.description}\nAuthors: ${i.meta.authors}`} />}
              >
                <input
                  className="c-input_checkbox"
                  type="checkbox"
                  checked={plugins.getRopePluginEnabled(i.id)}
                  onChange={e => {
                    plugins.setRopePluginEnabled(i.id, e.target.checked);
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

        const PatchedTabs = api.react.patchedComponent(Tabs, props => {
          if (!(props?.className === "p-prefs_dialog__tabs" && props?.tabs?.length > 0))
            return <Tabs {...props} />;

          const [isTabSelected, setIsTabSelected] = React.useState(false);

          const newTabItem = {
            id: "rope",
            label: <>Rope</>,
            content: <RopeMenu />,
            "aria-label": "rope",
            svgIcon: { name: "code" },
          } satisfies TabsItemData;
          let tabs = [...props.tabs, newTabItem];

          const oldTabChange = props.onTabChange;
          const handleTabChange = React.useCallback((id: string, e: React.UIEvent) => {
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

        return PatchedTabs;
      },
    }];
  },
});
