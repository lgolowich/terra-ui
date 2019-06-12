import * as clipboard from 'clipboard-polyfill'
import _ from 'lodash/fp'
import { forwardRef, Fragment, useRef, useState } from 'react'
import { div, h, iframe } from 'react-hyperscript-helpers'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { NewClusterModal } from 'src/components/ClusterManager'
import { buttonPrimary, buttonSecondary, Clickable, linkButton, MenuButton, menuIcon } from 'src/components/common'
import { icon, spinner } from 'src/components/icons'
import Modal from 'src/components/Modal'
import { NotebookDuplicator } from 'src/components/notebook-utils'
import { notify } from 'src/components/Notifications'
import PopupTrigger from 'src/components/PopupTrigger'
import { Ajax, useCancellation } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { reportError, withErrorReporting } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import * as Utils from 'src/libs/utils'
import ExportNotebookModal from 'src/pages/workspaces/workspace/notebooks/ExportNotebookModal'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const StatusMessage = ({ showSpinner, children }) => {
  return div({ style: { padding: '1.5rem 2rem', display: 'flex' } }, [
    showSpinner && spinner({ style: { marginRight: '0.5rem' } }),
    div([children])
  ])
}

const NotebookLauncher = _.flow(
  forwardRef,
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceTab(props, 'notebooks'),
    title: _.get('notebookName'),
    showTabBar: false
  })
)(({ notebookName, workspace, workspace: { workspace: { namespace } }, cluster, refreshClusters }) => {
  const [createOpen, setCreateOpen] = useState(false)
  // Status note: undefined means still loading, null means no cluster
  const clusterStatus = cluster && cluster.status
  const [mode, setMode] = useState()
  const onEdit = () => setMode('Edit')
  const onPlayground = () => setMode('Playground')

  console.log(clusterStatus)
  console.log(mode)

  return h(Fragment, [
    (clusterStatus === 'Running' && mode) && h(NotebookEditorFrame, { key: cluster.clusterName, workspace, cluster, notebookName, mode }),
    (clusterStatus !== undefined && !(clusterStatus === 'Running' && mode)) && h(Fragment, [h(PreviewHeader, { clusterStatus, cluster, refreshClusters, notebookName, onEdit, onPlayground, workspace }), h(NotebookPreviewFrame, { notebookName, workspace })]),
    createOpen && h(NewClusterModal, {
      namespace, currentCluster: cluster,
      onCancel: () => setCreateOpen(false),
      onSuccess: withErrorReporting('Error creating cluster', async promise => {
        setCreateOpen(false)
        await promise
        await refreshClusters()
      })
    })
  ])
})

const FileInUseModal = ({ lockedBy, onDismiss, onCopy, onPlaygroundMode }) => {
  return h(Modal, {
    width: 530,
    title: 'File Is In Use',
    onDismiss,
    showButtons: false
  }, [
    `File is currently in use by ${lockedBy}.`,
    div({ style: { flexGrow: 1 } }),
    'You can make a copy, or run it in Playground Mode to explore and execute its contents without saving any changes.',
    div({}, [
      buttonSecondary({
        style: { paddingRight: '1rem', paddingLeft: '1rem' },
        onClick: () => onDismiss()
      }, ['CANCEL']),
      buttonSecondary({
        style: { paddingRight: '1rem', paddingLeft: '1rem' },
        onClick: () => onCopy()
      }, ['MAKE A COPY']),
      buttonPrimary({
        onClick: () => onPlaygroundMode()
      }, ['RUN IN PLAYGROUND MODE'])
    ])
  ])
}

const PlaygroundModal = ({ user, onDismiss, onPlaygroundMode }) => {
  return h(Modal, {
    width: 530,
    title: 'Playground Mode',
    onDismiss,
    okButton: buttonPrimary({ onClick: () => onPlaygroundMode() }, 'Continue')
  }, [
    `Playground mode allows you to explore, change, and run the code, but your edits will not be saved.`,
    div({ style: { flexGrow: 1 } }),
    'To save your work, choose Make a Copy from the File menu to make your own version.'
  ])
}

const PreviewHeader = ({ cluster, refreshClusters, notebookName, onEdit, onPlayground, workspace, workspace: {  workspace: { namespace, name, bucketName } } }) => {
  const signal = useCancellation()
  const [createOpen, setCreateOpen] = useState(false)
  const [fileInUseOpen, setFileInUseOpen] = useState(false)
  const [playgroundModalOpen, setPlaygroundModalOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lockedBy, setLockedBy] = useState()
  const [exportingNotebookName, setExportingNotebookName] = useState()
  const [copyingNotebookName, setCopyingNotebookName] = useState()
  const clusterStatus = cluster.status
  const notebookLink = Nav.getLink('workspace-notebook-launch', { namespace, name: name, notebookName: notebookName })

  const testingPlaygroundModal = true

  const checkIfLocked = _.flow(
    withErrorReporting('Error checking notebook lock status')
  )(async () => {
    const notebook = await Ajax(signal).Buckets.notebook(namespace, bucketName, notebookName.slice(0, -6)).getObject()
    const lastLockedBy = notebook.metadata['lastLockedBy']
    const lockExpiration = notebook.metadata['lockExpiration']
    const lockExpirationDate = new Date(lockExpiration)

    if (lastLockedBy && lastLockedBy !== cluster.creator && lockExpirationDate > Date.now()) {
      setLocked(true)
      setLockedBy(lastLockedBy)
    }
  })

  Utils.useOnMount(() => { checkIfLocked() })

  const chooseModeActions = async (mode, status) => {
    if (status === 'Stopped') {
      await Ajax().Jupyter.cluster(namespace, cluster.clusterName).start()
      await refreshClusters()
    } else if (status === null) {
      setCreateOpen(true)
    }

    if (mode === 'Edit'){
      onEdit()
    } else if (mode === 'Playground') {
      if (testingPlaygroundModal){
        setPlaygroundModalOpen(true)
      } else {
        onPlayground()
      }
    }
  }

  return div({ style: { display: 'flex', alignItems: 'center', borderBottom: `2px solid ${colors.dark(0.2)}` } }, [
    div({ style: { fontSize: 16, fontWeight: 'bold', backgroundColor: colors.dark(0.2), paddingRight: '4rem', paddingLeft: '4rem' } },
      ['PREVIEW (READ-ONLY)']),
    div({},
      [Utils.cond(
        [clusterStatus === 'Creating', () => h(StatusMessage, { showSpinner: true }, [
          'Creating notebook runtime environment, this will take 5-10 minutes. You can navigate away and return when it’s ready.'
        ])],
        [clusterStatus === 'Starting', () => h(StatusMessage, { showSpinner: true }, [
          'Starting notebook runtime environment, this may take up to 2 minutes.'
        ])],
        [clusterStatus === 'Stopping', () => h(StatusMessage, { showSpinner: true }, [
          'Notebook runtime environment is stopping. You can restart it after it finishes.'])],
        [clusterStatus === 'Error', () => h(StatusMessage, ['Notebook runtime error.'])],
        [clusterStatus === 'Running' || clusterStatus === 'Stopped' || clusterStatus === null,
          () => h(Fragment, [
            !locked ? buttonSecondary({
              style: { paddingRight: '1rem', paddingLeft: '1rem', backgroundColor: colors.dark(0.1) },
              onClick: () => setFileInUseOpen(true)
            }, [icon('edit'), 'EDIT (IN USE)']) : buttonSecondary({
              style: { paddingRight: '1rem', paddingLeft: '1rem', backgroundColor: colors.dark(0.1) },
              onClick: () => chooseModeActions('Edit', clusterStatus)
            }, [icon('edit'), 'EDIT']),
            buttonSecondary({
              style: { paddingRight: '1rem', paddingLeft: '1rem', backgroundColor: colors.dark(0.1) },
              onClick: () => chooseModeActions('Playground', clusterStatus)
            }, [icon('export'), 'PLAYGROUND MODE']),
            buttonSecondary({
              style: { paddingRight: '1rem', paddingLeft: '1rem', backgroundColor: colors.dark(0.1) }
            }, [h(PopupTrigger, {
              closeOnClick: true,
              content: h(Fragment, [
                h(MenuButton, { onClick: () => setCopyingNotebookName(notebookName) }, ['Make a Copy']),
                h(MenuButton, { onClick: () => setExportingNotebookName(notebookName) }, ['Copy to another workspace']),
                h(MenuButton, { onClick: async () => {
                  try {
                    await clipboard.writeText(`${window.location.host}/${notebookLink}`)
                    notify('success', 'Successfully copied URL to clipboard', { timeout: 3000 })
                  } catch (error) {
                    reportError('Error copying to clipboard', error)
                  }
                }}, ['Copy URL to clipboard'])
              ]),
              side: 'bottom'
            }, [
              h(Clickable, {}, [icon('ellipsis-v', {})])
            ])])
          ])]
      )]),
    div({ style: { flexGrow: 1 } }),
    linkButton({
      style: { marginRight: '2rem' },
      href: Nav.getLink('workspace-notebooks', { namespace, name })
    }, [icon('times', { size: 30 })]),
    createOpen && h(NewClusterModal, {
      namespace, currentCluster: cluster,
      onCancel: () => setCreateOpen(false),
      onSuccess: withErrorReporting('Error creating cluster', async promise => {
        setCreateOpen(false)
        await promise
        await refreshClusters()
      })
    }),
    fileInUseOpen && h(FileInUseModal, {
      lockedBy,
      onDismiss: () => setFileInUseOpen(false),
      onCopy: () => setCopyingNotebookName(notebookName),
      onPlaygroundMode: () => chooseModeActions('Playground', clusterStatus)
    }),
    copyingNotebookName && h(NotebookDuplicator, {
      printName: copyingNotebookName.slice(0, -6),
      existingNames: [], namespace, bucketName, destroyOld: false,
      onDismiss: () => setCopyingNotebookName(undefined),
      onSuccess: () => {
        setCopyingNotebookName(undefined)
      }
    }),
    exportingNotebookName && h(ExportNotebookModal, {
      printName: exportingNotebookName.slice(0, -6), workspace,
      onDismiss: () => setExportingNotebookName(undefined)
    }),
    playgroundModalOpen && h(PlaygroundModal, {
      user: cluster.creator,
      onDismiss: () => setPlaygroundModalOpen(false),
      onPlaygroundMode: () => onPlayground
    })
  ])
}

const NotebookPreviewFrame = ({ notebookName, workspace: { workspace: { namespace, name, bucketName } } }) => {
  const signal = useCancellation()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState()
  const frame = useRef()

  const loadPreview = _.flow(
    Utils.withBusyState(setBusy),
    withErrorReporting('Error previewing notebook')
  )(async () => {
    setPreview(await Ajax(signal).Buckets.notebook(namespace, bucketName, notebookName).preview())
  })
  Utils.useOnMount(() => {
    loadPreview()
  })

  return h(Fragment, [
    preview && h(Fragment, [
      iframe({
        ref: frame,
        onLoad: () => {
          const doc = frame.current.contentWindow.document
          doc.head.appendChild(Utils.createHtmlElement(doc, 'base', Utils.newTabLinkProps))
        },
        style: { border: 'none', flex: 1 },
        srcDoc: preview
      })
    ]),
    busy && div({ style: { margin: '0.5rem 2rem' } }, ['Generating preview...'])
  ])
}

const JupyterFrameManager = ({ onClose, frameRef }) => {
  Utils.useOnMount(() => {
    const isSaved = Utils.atom(true)
    const onMessage = e => {
      switch (e.data) {
        case 'close': return onClose()
        case 'saved': return isSaved.set(true)
        case 'dirty': return isSaved.set(false)
        default:
      }
    }
    const saveNotebook = () => {
      frameRef.current.contentWindow.postMessage('save', '*')
    }
    const onBeforeUnload = e => {
      if (!isSaved.get()) {
        saveNotebook()
        e.preventDefault()
      }
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('beforeunload', onBeforeUnload)
    Nav.blockNav.set(() => new Promise(resolve => {
      if (isSaved.get()) {
        resolve()
      } else {
        saveNotebook()
        isSaved.subscribe(resolve)
      }
    }))
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('beforeunload', onBeforeUnload)
      Nav.blockNav.reset()
    }
  })
  return null
}

const NotebookEditorFrame = ({ mode, notebookName, workspace: { workspace: { namespace, name, bucketName } }, cluster: { clusterName, clusterUrl, status } }) => {
  console.assert(status === 'Running', 'Expected cluster to be running')
  const signal = useCancellation()
  const frameRef = useRef()
  const [busy, setBusy] = useState(false)
  const [notebookSetUp, setNotebookSetUp] = useState(false)

  const localBaseDirectory = `${name}/`
  const localSafeModeBaseDirectory = `/safe/${name}`
  const cloudStorageDirectory = `gs://${bucketName}/notebooks`

  const setUpNotebook = _.flow(
    Utils.withBusyState(setBusy),
    withErrorReporting('Error setting up notebook')
  )(async () => {
    if (mode === 'Edit'){
      console.log("Setting up notebook to edit")
      Promise.all([
        Ajax(signal).Jupyter.notebooks(namespace, clusterName).localize({
          [`~/${name}/.delocalize.json`]: `data:application/json,{"destination":"gs://${bucketName}/notebooks","pattern":""}`,
          [`~/${name}/${notebookName}`]: `gs://${bucketName}/notebooks/${notebookName}`
        }),
        Ajax(signal).Jupyter.notebooks(namespace, clusterName).setCookie()
        // Ajax(signal).Jupyter.notebooks(namespace, clusterName).lock(`/notebooks/${notebookName}`),
        // Ajax(signal).Jupyter.notebooks(namespace, clusterName).storageLinks(localBaseDirectory, localSafeModeBaseDirectory, cloudStorageDirectory, `.*\\.ipynb`),
        // Ajax(signal).Jupyter.notebooks(namespace, clusterName).localize([{
        //   'sourceUri': `${cloudStorageDirectory}/${notebookName}`,
        //   'localDestinationPath': localBaseDirectory
        // }])
        // Ajax(signal).Jupyter.notebooks(namespace, clusterName).setCookie()
      ])
    } else {
      console.log("Setting up notebook for playground mode")
      Promise.all([
        Ajax(signal).Jupyter.notebooks(namespace, clusterName).localize({
          [`~/${name}/.delocalize.json`]: `data:application/json,{"destination":"gs://${bucketName}/notebooks","pattern":""}`,
          [`~/${name}/${notebookName}`]: `gs://${bucketName}/notebooks/${notebookName}`
        }),
        Ajax(signal).Jupyter.notebooks(namespace, clusterName).setCookie()
        // Ajax(signal).Jupyter.notebooks(namespace, clusterName).storageLinks(localBaseDirectory, localSafeModeBaseDirectory, cloudStorageDirectory, `.*\\.ipynb`),
        // Ajax(signal).Jupyter.notebooks(namespace, clusterName).localize([{
        //   'sourceUri': `${cloudStorageDirectory}/${notebookName}`,
        //   'localDestinationPath': localSafeModeBaseDirectory
        // }])
        // Ajax(signal).Jupyter.notebooks(namespace, clusterName).setCookie()
      ])
    }
    setNotebookSetUp(true)
  })

  const checkRecentAccess = async () => {
    const { updated } = await Ajax(signal).Buckets.notebook(namespace, bucketName, notebookName.slice(0, -6)).getObject()
    const tenMinutesAgo = _.tap(d => d.setMinutes(d.getMinutes() - 10), new Date())
    if (new Date(updated) > tenMinutesAgo) {
      notify('warn', 'This notebook has been edited recently', {
        message: 'If you recently edited this notebook, disregard this message. If another user is editing this notebook, your changes may be lost.',
        timeout: 30000
      })
    }
  }
  Utils.useOnMount(() => {
    setUpNotebook()
    checkRecentAccess()
  })
  return h(Fragment, [
    notebookSetUp && h(Fragment, [
      iframe({
        src: `${clusterUrl}/notebooks/${name}/${notebookName}`,
        style: { border: 'none', flex: 1 },
        ref: frameRef
      }),
      h(JupyterFrameManager, {
        frameRef,
        onClose: () => Nav.goToPath('workspace-notebooks', { namespace, name })
      })
    ]),
    busy && h(StatusMessage, { showSpinner: true }, ['Copying notebook to runtime environment, almost ready...'])
  ])
}

export const navPaths = [
  {
    name: 'workspace-notebook-launch',
    path: '/workspaces/:namespace/:name/notebooks/launch/:notebookName',
    component: NotebookLauncher,
    title: ({ name, notebookName }) => `${notebookName} - ${name}`
  }
]
