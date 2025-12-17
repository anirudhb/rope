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
          deleted: v.enterprise_user.teams.length === 0 ? "by_fd" : v.deleted,
        }]));
    }
    return s2;
  });

  const { SvgIcon } = api.slack;

  const unpatchMemberProfileRestriction = api.react.patchComponentWithTester2(api.slack.MemberProfileRestriction, (props) => props.member?.deleted === "by_fd", MemberProfileRestriction => props => {
    return <div className={`${props.className ?? ""} p-member_profile_restriction_deleted`}>
      <div className="p-member_profile_restriction__svg_icon">
        <SvgIcon inline={true} name="archive-filled" />
      </div>
      <span className="p-member_profile_restriction__text_deleted">
        Deactivated by FD
      </span>
    </div>
  });

  /* popover isn't patchable because it doesn't give us enough info */

  return () => {
    unpatchMemberProfileRestriction();
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
