/** Shows users with no shared workspaces as deactivated by FD */
import type { RopePlugin, RopePluginInit } from "../api";

const init: RopePluginInit = (api) => {
  const unpatchMemberReduxPatch = api.redux.insertReduxReducerPatch("slack", "DeactivatedByFD", (s, a, r) => {
    const s2 = r(s, a);
    /* cheap and guaranteed to work because redux */
    if (!Object.is(s.members, s2.members)) {
      s2.members = Object.fromEntries(Object.entries(s2.members.__proto__)
        .map(([k, v]: [any, any]) => [k, {
          ...v,
          deleted: v.enterprise_user.teams.length === 0 ? true : v.deleted,
        }]));
    }
    return s2;
  });

  return () => {
    unpatchMemberReduxPatch();
  };
};

export default {
  id: "DeactivatedByFD",
  meta: {
    name: "Deactivated By FD",
    description: "Shows users with no shared workspaces as deactivated (by FD)",
    authors: "<@U01D9DWGEB0>",
  },
  init,
} satisfies RopePlugin;
