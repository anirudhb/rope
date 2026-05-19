// Rope menu
import * as plugins from "../plugins";
import {
  Alert as AlertI,
  Tabs as TabsI,
  TabsItemData,
  FieldSet as FieldSetI,
  Legend as LegendI,
  Label as LabelI,
  MrkdwnElement as MrkdwnElementI,
} from "../slack";
import { WebpackImported } from "jspatching/webpack";

export default plugins.wirePlugin({
  AlertI,
  FieldSetI,
  LegendI,
  LabelI,
  MrkdwnElementI,
}, undefined, {
  id: "menu",
  meta: {
    name: "Rope menu",
    description: "Provides a menu to configure and view Rope",
    authors: "<@U01D9DWGEB0>",
  },
  newModules: {
    menuConfigUi: (module, _exports, _require) => {
      module.exports = {};
      //module.exports = function(React: typeof import("react")) {
      //  return <></>;
      //};
    },
  },
  init(api, { AlertI, FieldSetI, LegendI, LabelI, MrkdwnElementI, extraModules: { menuConfigUi: menuConfigUiI } }) {
    return {
      modules: [],
      components: [{
        debugName: "rope-menu-tabs-patch",
        componentName: "Tabs",
        dependencies: [AlertI, MrkdwnElementI, FieldSetI, LegendI, LabelI],
        patch: (require, React, Tabs: WebpackImported<typeof TabsI>) => {
          const Alert = api.webpack.requireWebpackExport(require, AlertI);
          const MrkdwnElement = api.webpack.requireWebpackExport(require, MrkdwnElementI);
          const FieldSet = api.webpack.requireWebpackExport(require, FieldSetI);
          const Legend = api.webpack.requireWebpackExport(require, LegendI);
          const Label = api.webpack.requireWebpackExport(require, LabelI);
          let menuConfigUi: any;
          let menuConfigUiCache = {};
          // hack
          api.webpack.requireWebpackExport(require, menuConfigUiI);

          function bindMenuConfigUi() {
            if (menuConfigUi)
              return;
            menuConfigUi = api.webpack.requireWebpackExport(require, menuConfigUiI);
          }

          function getCachedMenuConfigUi(React: typeof import("react"), id: string): React.FC | null {
            if (menuConfigUi[id]) {
              if (menuConfigUiCache[id]) {
                return menuConfigUiCache[id];
              } else {
                const x = menuConfigUi[id](React);
                menuConfigUiCache[id] = x;
                return x;
              }
            } else {
              return null;
            }
          }

          function PluginsList() {
            // hack
            bindMenuConfigUi();
            const [plugins_, setPlugins_] = React.useState<plugins.RopePlugin[]>([...plugins.__ropePluginRegistry.values()]);

            function reloadPluginsList() {
              setPlugins_([...plugins.__ropePluginRegistry.values()]);
            }
            React.useEffect(reloadPluginsList, [[...plugins.__ropePluginRegistry.keys()]]);

            return <FieldSet id="rope-plugins-list">
              <Legend className="margin_bottom_100">Rope plugins</Legend>
              <Alert level="info" type="boxed">
                Changes require a reload to take effect.
              </Alert>
              <br />
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
                      plugins.refreshCachedExportIds();
                      reloadPluginsList();
                    }}
                  />
                </Label>
                {menuConfigUi[i.id] && React.createElement(getCachedMenuConfigUi(React, i.id))}
              </div>)}
              <hr/>
              <MrkdwnElement text={`Plugin configurations are stored in \`localStorage\`.\nThings are unstable and may break, your computer might even catch on fire. Please report any bugs!`} />
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
      }],
    };
  },
});
