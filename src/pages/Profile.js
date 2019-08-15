import { addDays } from 'date-fns'
import _ from 'lodash/fp'
import * as qs from 'qs'
import { Component, Fragment, useState } from 'react'
import { div, h, label, span } from 'react-hyperscript-helpers'
import { ButtonPrimary, IdContainer, LabeledCheckbox, Link, RadioButton, ShibbolethLink, spinnerOverlay } from 'src/components/common'
import { centeredSpinner, icon, profilePic, spinner } from 'src/components/icons'
import { TextInput, ValidatedInput } from 'src/components/input'
import { InfoBox } from 'src/components/PopupTrigger'
import TopBar from 'src/components/TopBar'
import { Ajax, ajaxCaller, useCancellation } from 'src/libs/ajax'
import { getUser, refreshTerraProfile } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { withErrorReporting } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import { authStore } from 'src/libs/state'
import * as Utils from 'src/libs/utils'
import validate from 'validate.js'


const styles = {
  page: {
    margin: '0 2rem 2rem',
    width: 700
  },
  sectionTitle: {
    margin: '2rem 0 1rem',
    color: colors.dark(), fontSize: 16, fontWeight: 600, textTransform: 'uppercase'
  },
  header: {
    line: {
      margin: '0 2rem',
      display: 'flex', alignItems: 'center'
    },

    nameLine: {
      marginLeft: '1rem',
      color: colors.dark(),
      fontSize: '150%'
    }
  },
  form: {
    line: {
      display: 'flex', justifyContent: 'space-between',
      margin: '2rem 0'
    },
    container: {
      width: 320
    },
    title: {
      whiteSpace: 'nowrap', fontSize: 16,
      marginBottom: '0.3rem'
    },
    checkboxLine: {
      margin: '0.75rem 0'
    },
    checkboxLabel: {
      marginLeft: '0.5rem'
    }
  }
}


const NihLink = ({ nihToken }) => {
  /*
   * Hooks
   */
  const { nihStatus } = Utils.useAtom(authStore)
  const [linking, setLinking] = useState(false)
  const signal = useCancellation()

  Utils.useOnMount(() => {
    const { User } = Ajax(signal)

    const linkNihAccount = _.flow(
      withErrorReporting('Error linking NIH account'),
      Utils.withBusyState(setLinking)
    )(async () => {
      const nihStatus = await User.linkNihAccount(nihToken)
      authStore.update(state => ({ ...state, nihStatus }))
    })

    if (nihToken) {
      // Clear the query string, but use replace so the back button doesn't take the user back to the token
      Nav.history.replace({ search: '' })
      linkNihAccount()
    }
  })


  /*
   * Render helpers
   */
  const renderDatasetAuthStatus = ({ name, authorized }) => {
    return div({ key: `nih-auth-status-${name}`, style: { display: 'flex' } }, [
      div({ style: { flex: 1 } }, [`${name} Authorization`]),
      div({ style: { flex: 2 } }, [
        authorized ? 'Authorized' : span({ style: { marginRight: '0.5rem' } }, ['Not Authorized']),
        !authorized && h(InfoBox, [
          'Your account was linked, but you are not authorized to view this controlled dataset. Please go ',
          h(Link, {
            href: 'https://dbgap.ncbi.nlm.nih.gov/aa/wga.cgi?page=login',
            ...Utils.newTabLinkProps
          }, [
            'here',
            icon('pop-out', { size: 12 })
          ]),
          ' to check your credentials.'
        ])
      ])
    ])
  }

  const renderStatus = () => {
    const { linkedNihUsername, linkExpireTime, datasetPermissions } = nihStatus
    return h(Fragment, [
      !linkedNihUsername && h(ShibbolethLink, ['Log in to NIH to link your account']),
      !!linkedNihUsername && div({ style: { display: 'flex', flexDirection: 'column', width: '33rem' } }, [
        div({ style: { display: 'flex' } }, [
          div({ style: { flex: 1 } }, ['Username:']),
          div({ style: { flex: 2 } }, [linkedNihUsername])
        ]),
        div({ style: { display: 'flex' } }, [
          div({ style: { flex: 1 } }, ['Link Expiration:']),
          div({ style: { flex: 2 } }, [
            div([Utils.makeCompleteDate(linkExpireTime * 1000)]),
            div([h(ShibbolethLink, ['Log in to NIH to re-link your account'])])
          ])
        ]),
        _.flow(
          _.sortBy('name'),
          _.map(renderDatasetAuthStatus)
        )(datasetPermissions)
      ])
    ])
  }

  const loading = !nihStatus

  /*
   * Render
   */
  return div({ style: { marginBottom: '1rem' } }, [
    div({ style: styles.form.title }, [
      span({ style: { marginRight: '0.5rem' } }, ['NIH Account']),
      h(InfoBox, [
        'Linking with eRA Commons will allow Terra to automatically determine if you can access controlled datasets hosted in Terra (ex. TCGA) based on your valid dbGaP applications.'
      ])
    ]),
    Utils.cond(
      [loading, () => div([spinner(), 'Loading NIH account status...'])],
      [linking, () => div([spinner(), 'Linking NIH account...'])],
      () => renderStatus()
    )
  ])
}


const FenceLink = ({ provider, displayName }) => {
  const decodeProvider = state => state ? JSON.parse(atob(state)).provider : ''

  const extractToken = (provider, { state, code }) => {
    const extractedProvider = decodeProvider(state)
    return extractedProvider && provider === extractedProvider ? code : undefined
  }

  const queryParams = qs.parse(window.location.search, { ignoreQueryPrefix: true })
  const token = extractToken(provider, queryParams)
  const redirectUrl = `${window.location.origin}/${Nav.getLink('fence-callback')}`

  /*
   * Hooks
   */
  const [{ username, issued_at: issuedAt }, setStatus] = useState({})
  const [href, setHref] = useState(undefined)
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [isLoadingAuthUrl, setIsLoadingAuthUrl] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const signal = useCancellation()

  const { User } = Ajax(signal)

  const loadAuthUrl = _.flow(
    withErrorReporting(`Error loading Fence link`),
    Utils.withBusyState(setIsLoadingAuthUrl)
  )(async () => {
    const result = await User.getFenceAuthUrl(provider, redirectUrl)
    setHref(result.url)
  })

  const loadFenceStatus = _.flow(
    withErrorReporting(`Error loading status for ${displayName}`),
    Utils.withBusyState(setIsLoadingStatus)
  )(async () => {
    try {
      setStatus(await User.getFenceStatus(provider))
    } catch (error) {
      if (error.status === 404) {
        setStatus({})
      } else {
        throw error
      }
    }
  })

  const linkFenceAccount = _.flow(
    withErrorReporting('Error linking NIH account'),
    Utils.withBusyState(setIsLinking)
  )(async () => {
    setStatus(await User.linkFenceAccount(provider, token, redirectUrl))
  })

  Utils.useOnMount(() => {
    loadAuthUrl()
  })

  Utils.useOnMount(() => {
    if (token) {
      const profileLink = `/${Nav.getLink('profile')}`
      window.history.replaceState({}, '', profileLink)
      linkFenceAccount()
    } else {
      loadFenceStatus()
    }
  })

  /*
   * Render helpers
   */
  const renderFrameworkServicesLink = linkText => {
    return href && h(Link, { href, style: { display: 'flex', alignItems: 'center' } }, [
      linkText,
      icon('pop-out', { size: 12, style: { marginLeft: '0.5rem' } })
    ])
  }

  /*
   * Render
   */
  const isBusy = isLoadingStatus || isLoadingAuthUrl || isLinking
  const expireTime = addDays(issuedAt, 30)

  return div({ style: { marginBottom: '1rem' } }, [
    div({ style: styles.form.title }, [displayName]),
    isBusy && div([spinner(), 'Loading account status...']),
    !isBusy && h(Fragment, [
      !username && renderFrameworkServicesLink('Log-In to Framework Services to link your account'),
      !!username && div({ style: { display: 'flex', flexDirection: 'column', width: '33rem' } }, [
        div({ style: { display: 'flex' } }, [
          div({ style: { flex: 1 } }, ['Username:']),
          div({ style: { flex: 2 } }, [username])
        ]),
        div({ style: { display: 'flex' } }, [
          div({ style: { flex: 1 } }, ['Link Expiration:']),
          div({ style: { flex: 2 } }, [Utils.makeCompleteDate(expireTime)])
        ]),
        renderFrameworkServicesLink('Log-In to Framework Services to re-link your account')
      ])
    ])
  ])
}


const sectionTitle = text => div({ style: styles.sectionTitle }, [text])

const Profile = _.flow(
  ajaxCaller,
  Utils.connectAtom(authStore, 'authState')
)(class Profile extends Component {
  constructor(props) {
    super(props)

    this.state = { profileInfo: _.mapValues(v => v === 'N/A' ? '' : v, props.authState.profile) }
  }

  render() {
    const { queryParams = {} } = this.props
    const { profileInfo, saving } = this.state
    const { firstName } = profileInfo

    return h(Fragment, [
      saving && spinnerOverlay,
      h(TopBar),
      div({ role: 'main' }, [
        !profileInfo ? centeredSpinner() : h(Fragment, [
          div({ style: { marginLeft: '2rem' } }, [sectionTitle('Profile')]),
          div({ style: styles.header.line }, [
            div({ style: { position: 'relative' } }, [
              profilePic({ size: 48 }),
              h(InfoBox, { style: { alignSelf: 'flex-end', padding: '0.25rem' } }, [
                'To change your profile image, visit your ',
                h(Link, {
                  href: `https://myaccount.google.com?authuser=${getUser().email}`,
                  ...Utils.newTabLinkProps
                }, ['Google account page.'])
              ])
            ]),
            div({ style: styles.header.nameLine }, [
              `Hello again, ${firstName}`
            ])
          ]),
          div({ style: { display: 'flex' } }, [
            div({ style: styles.page }, [
              this.renderForm()
            ]),
            div({ style: { marginTop: '0', marginLeft: '1rem' } }, [
              sectionTitle('Identity & External Servers'),
              h(NihLink, { nihToken: queryParams['nih-username-token'] }),
              h(FenceLink, {
                provider: 'fence',
                displayName: 'DCP Framework Services by University of Chicago'
              }),
              h(FenceLink, {
                provider: 'dcf-fence',
                displayName: 'DCF Framework Services by University of Chicago'
              })
            ])
          ])
        ])
      ])
    ])
  }

  renderForm() {
    const { profileInfo, proxyGroup } = this.state

    const { firstName, lastName } = profileInfo
    const required = { presence: { allowEmpty: false } }
    const errors = validate({ firstName, lastName }, { firstName: required, lastName: required })

    const line = (...children) => div({ style: styles.form.line }, children)

    const textField = (key, title, { placeholder, required } = {}) => h(IdContainer, [id => div({ style: styles.form.container }, [
      label({ htmlFor: id, style: styles.form.title }, [title]),
      required ?
        h(ValidatedInput, {
          inputProps: {
            id,
            value: profileInfo[key],
            onChange: v => this.assignValue(key, v),
            placeholder: placeholder || 'Required'
          },
          error: Utils.summarizeErrors(errors && errors[key])
        }) :
        h(TextInput, {
          id,
          value: profileInfo[key],
          onChange: v => this.assignValue(key, v),
          placeholder
        })
    ])])

    const radioButton = (key, value) => h(RadioButton, {
      text: value, name: key, checked: profileInfo[key] === value,
      labelStyle: { margin: '0 2rem 0 0.25rem' },
      onChange: () => this.assignValue(key, value)
    })

    const checkbox = (key, title) => div({ style: styles.form.checkboxLine }, [
      h(LabeledCheckbox, {
        checked: profileInfo[key] === 'true',
        onChange: v => this.assignValue(key, v.toString())
      }, [span({ style: styles.form.checkboxLabel }, [title])])
    ])

    return h(Fragment, [
      line(
        textField('firstName', 'First Name', { required: true }),
        textField('lastName', 'Last Name', { required: true })
      ),
      line(
        textField('title', 'Title')
      ),
      line(
        div([
          div({ style: styles.form.title }, ['Email']),
          div({ style: { margin: '1rem' } }, [profileInfo.email])
        ]),
        textField('contactEmail', 'Contact Email for Notifications (if different)', { placeholder: profileInfo.email })
      ),
      line(
        textField('institute', 'Institution'),
        textField('institutionalProgram', 'Institutional Program')
      ),

      div({ style: styles.form.title }, [
        span({ style: { marginRight: '0.5rem' } }, ['Proxy Group']),
        h(InfoBox, [
          'For more information about proxy groups, see the ',
          h(Link, {
            href: 'https://software.broadinstitute.org/firecloud/documentation/article?id=11185',
            ...Utils.newTabLinkProps
          }, ['user guide.'])
        ])
      ]),
      div({ style: { margin: '1rem' } }, [proxyGroup]),

      sectionTitle('Program Info'),

      div({ style: styles.form.title }, ['Non-Profit Status']),
      div({ style: { margin: '1rem' } }, [
        radioButton('nonProfitStatus', 'Profit'),
        radioButton('nonProfitStatus', 'Non-Profit')
      ]),
      line(
        textField('pi', 'Principal Investigator/Program Lead')
      ),
      line(
        textField('programLocationCity', 'City'),
        textField('programLocationState', 'State')
      ),
      line(
        textField('programLocationCountry', 'Country')
      ),

      sectionTitle('Account Notifications'),

      checkbox('notifications/GroupAccessRequestNotification', 'Group Access Requested'),
      checkbox('notifications/WorkspaceAddedNotification', 'Workspace Access Added'),
      checkbox('notifications/WorkspaceRemovedNotification', 'Workspace Access Removed'),

      h(ButtonPrimary, {
        style: { marginTop: '3rem' },
        onClick: () => this.save(),
        disabled: !!errors,
        tooltip: !!errors && 'Please fill out all required fields'
      }, ['Save Profile'])
    ])
  }

  assignValue(key, value) {
    this.setState({ profileInfo: _.set(key, value, this.state.profileInfo) })
  }

  save = _.flow(
    Utils.withBusyState(v => this.setState({ saving: v })),
    withErrorReporting('Error saving profile')
  )(async () => {
    const { profileInfo } = this.state

    const [prefsData, profileData] = _.over([_.pickBy, _.omitBy])((v, k) => _.startsWith('notifications/', k), profileInfo)
    await Promise.all([
      Ajax().User.profile.set(_.pickBy(_.identity, profileData)),
      Ajax().User.profile.setPreferences(prefsData)
    ])
    await refreshTerraProfile()
  })

  async componentDidMount() {
    const { ajax: { User }, authState: { profile: { email } } } = this.props

    this.setState({ proxyGroup: await User.getProxyGroup(email) })
  }
})


export const navPaths = [
  {
    name: 'profile',
    path: '/profile',
    component: Profile,
    title: 'Profile'
  },
  {
    name: 'fence-callback',
    path: '/fence-callback',
    component: Profile,
    title: 'Profile'
  }
]
