import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as Chat2Types from '../../../constants/types/chat2'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Chat2Constants from '../../../constants/chat2'
import {Section as _Section} from '../../../common-adapters/section-list'
import flags from '../../../util/feature-flags'
import {useAllChannelMetas} from '../../common/channel-hooks'
import {getOrderedMemberArray, sortInvites, getOrderedBotsArray} from './helpers'
import MemberRow from './member-row/container'
import {BotRow, AddBotRow} from './bot-row'
import {RequestRow, InviteRow, InvitesEmptyRow} from './invite-row'
import {SubteamAddRow, SubteamIntroRow, SubteamNoneRow, SubteamTeamRow, SubteamInfoRow} from './subteam-row'
import {ChannelRow, ChannelHeaderRow, ChannelFooterRow} from './channel-row'
import {EmojiItemRow, EmojiAddRow, EmojiHeader} from './emoji-row'
import LoadingRow from './loading'

export type Section = _Section<
  any,
  {
    collapsed?: boolean
    onToggleCollapsed?: () => void
    title?: string
  }
>

export const useMembersSections = (
  teamID: Types.TeamID,
  meta: Types.TeamMeta,
  details: Types.TeamDetails,
  yourOperations: Types.TeamOperations
): Array<Section> => {
  const yourUsername = Container.useSelector(state => state.config.username)
  // TODO: figure out if this is bad for performance and if we should leave these functions early when we're not on that tab

  // TODO: consider moving this to the parent
  const stillLoading = meta.memberCount > 0 && !details.members.size
  return [
    {
      data: stillLoading ? ['loading'] : getOrderedMemberArray(details.members, yourUsername, yourOperations),
      key: 'member-members',
      renderItem: ({index, item}) =>
        item === 'loading' ? (
          <LoadingRow />
        ) : (
          <MemberRow teamID={teamID} username={item.username} firstItem={index == 0} />
        ),
      title: flags.teamsRedesign ? `Already in team (${meta.memberCount})` : '',
    },
  ]
}

export const useBotSections = (
  teamID: Types.TeamID,
  meta: Types.TeamMeta,
  details: Types.TeamDetails,
  yourOperations: Types.TeamOperations
): Array<Section> => {
  const stillLoading = meta.memberCount > 0 && !details.members.size
  return [
    {
      data: stillLoading ? ['loading'] : getOrderedBotsArray(details.members),
      key: 'bots',
      renderItem: ({item}) =>
        item === 'loading' ? <LoadingRow /> : <BotRow teamID={teamID} username={item.username} />,
    },
    ...(yourOperations.manageBots
      ? [{data: ['add-bot'], key: 'add-bots', renderItem: () => <AddBotRow teamID={teamID} />}]
      : []),
  ]
}

export const useInvitesSections = (teamID: Types.TeamID, details: Types.TeamDetails): Array<Section> => {
  const invitesCollapsed = Container.useSelector(state => state.teams.invitesCollapsed)
  const dispatch = Container.useDispatch()
  const collapsed = invitesCollapsed.has(teamID)
  const onToggleCollapsed = () => dispatch(TeamsGen.createToggleInvitesCollapsed({teamID}))

  const sections: Array<Section> = []

  let empty = true
  if (details.requests?.size) {
    empty = false
    sections.push({
      data: [...details.requests].map(req => {
        return {
          ctime: req.ctime,
          fullName: req.fullName,
          key: `invites-request:${req.username}`,
          username: req.username,
        }
      }),
      key: 'invite-requests',
      renderItem: ({item}) => <RequestRow {...item} teamID={teamID} />,
      title: Styles.isMobile ? `Requests (${details.requests.size})` : undefined,
    })
  }
  if (details.invites?.size) {
    empty = false
    sections.push({
      collapsed,
      data: collapsed ? [] : [...details.invites].sort(sortInvites),
      key: 'member-invites',
      onToggleCollapsed,
      renderItem: ({item}) => <InviteRow teamID={teamID} id={item.id} />,
      title: `Invitations (${details.invites.size})`,
    })
  }
  if (empty && !flags.teamsRedesign) {
    sections.push({data: ['invites-empty'], key: 'invites-empty', renderItem: () => <InvitesEmptyRow />})
  }
  return sections
}

export const useChannelsSections = (teamID: Types.TeamID, shouldActuallyLoad: boolean): Array<Section> => {
  const channelMetas = useAllChannelMetas(teamID, !shouldActuallyLoad /* dontCallRPC */)
  return [
    {data: ['channel-add'], key: 'channel-add', renderItem: () => <ChannelHeaderRow teamID={teamID} />},
    {
      data: [...channelMetas.values()].sort((a, b) =>
        a.channelname === 'general'
          ? -1
          : b.channelname === 'general'
          ? 1
          : a.channelname.localeCompare(b.channelname)
      ),
      key: 'channel-channels',
      renderItem: ({item}) => <ChannelRow teamID={teamID} channel={item} />,
    },
    {data: ['channel-info'], key: 'channel-info', renderItem: () => <ChannelFooterRow />},
  ]
}

export const useSubteamsSections = (
  teamID: Types.TeamID,
  details: Types.TeamDetails,
  yourOperations: Types.TeamOperations
): Array<Section> => {
  const subteamsFiltered = Container.useSelector(state => state.teams.subteamsFiltered)
  const subteams = (flags.teamsRedesign
    ? [...(subteamsFiltered ?? details.subteams)]
    : [...details.subteams]
  ).sort()
  const sections: Array<Section> = []
  if (!flags.teamsRedesign) {
    sections.push({
      data: ['subteam-intro'],
      key: 'subteam-intro',
      renderItem: () => <SubteamIntroRow teamID={teamID} />,
    })
  }
  if (yourOperations.manageSubteams) {
    sections.push({
      data: ['subteam-add'],
      key: 'subteam-add',
      renderItem: () => <SubteamAddRow teamID={teamID} />,
    })
  }
  sections.push({
    data: subteams,
    key: 'subteams',
    renderItem: ({item}) => <SubteamTeamRow teamID={item} />,
  })
  if (flags.teamsRedesign) {
    sections.push({data: ['subteam-info'], key: 'subteam-info', renderItem: () => <SubteamInfoRow />})
  } else if (!subteams.length) {
    sections.push({data: ['subteam-none'], key: 'subteam-none', renderItem: () => <SubteamNoneRow />})
  }
  return sections
}

const useGeneralConversationIDKey = (teamID?: Types.TeamID) => {
  const [conversationIDKey, setConversationIDKey] = React.useState<Chat2Types.ConversationIDKey | null>(null)
  const generalConvID = Container.useSelector(
    (state: Container.TypedState) => teamID && state.chat2.teamIDToGeneralConvID.get(teamID)
  )
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    if (!conversationIDKey && teamID) {
      if (!generalConvID) {
        dispatch(Chat2Gen.createFindGeneralConvIDFromTeamID({teamID}))
      } else {
        setConversationIDKey(generalConvID)
      }
    }
  }, [conversationIDKey, dispatch, generalConvID, teamID])
  return conversationIDKey
}

export const useEmojiSections = (teamID: Types.TeamID): Array<Section> => {
  const convID = useGeneralConversationIDKey(teamID)
  const getUserEmoji = Container.useRPC(RPCChatTypes.localUserEmojisRpcPromise)
  const [customEmoji, setCustomEmoji] = React.useState<RPCChatTypes.Emoji[]>([])
  const [waiting, setWaiting] = React.useState(true)

  const [filter, setFilter] = React.useState('')

  React.useEffect(() => {
    setWaiting(true)
    if (convID) {
      getUserEmoji(
        [
          {
            convID: Chat2Types.keyToConversationID(convID),
            opts: {
              getAliases: true,
              getCreationInfo: true,
              onlyInTeam: true,
            },
          },
        ],
        result => {
          let emojis: Array<RPCChatTypes.Emoji> = []
          result.emojis.emojis?.forEach(g => {
            emojis = emojis.concat(g.emojis ?? [])
          })
          setCustomEmoji(emojis)
          setWaiting(false)
        },
        _ => {
          setCustomEmoji([])
          setWaiting(false)
        }
      )
    } else {
      setWaiting(false)
    }
  }, [convID, getUserEmoji])

  let filteredEmoji: RPCChatTypes.Emoji[] = customEmoji
  if (filter != '') {
    filteredEmoji = filteredEmoji.filter(e => e.alias.includes(filter.toLowerCase()))
  }

  filteredEmoji = filteredEmoji.sort((a, b) => (b.creationInfo?.time ?? 0) - (a.creationInfo?.time ?? 0))
  const sections: Array<Section> = []
  sections.push({
    data: ['emoji-add'],
    key: 'emoji-add',
    renderItem: () => (
      <EmojiAddRow
        teamID={teamID}
        convID={convID ?? Chat2Constants.noConversationIDKey}
        filter={filter}
        setFilter={setFilter}
      />
    ),
  })

  sections.push({
    data: ['emoji-header'],
    key: 'emoji-header',
    renderItem: () => <EmojiHeader />,
  })

  if (!waiting && customEmoji) {
    sections.push({
      data: filteredEmoji,
      key: 'emoji-item',
      renderItem: ({item}) => <EmojiItemRow emoji={item} />,
    })
  }
  return sections
}
