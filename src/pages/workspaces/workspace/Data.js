import * as clipboard from 'clipboard-polyfill'
import FileSaver from 'file-saver'
import filesize from 'filesize'
import JSZip from 'jszip'
import _ from 'lodash/fp'
import { Component, createRef, Fragment, useEffect, useState } from 'react'
import { div, form, h, img, input } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { requesterPaysWrapper, withRequesterPaysHandler } from 'src/components/bucket-utils'
import { ButtonPrimary, Clickable, Link, Select, spinnerOverlay } from 'src/components/common'
import DataTable from 'src/components/DataTable'
import Dropzone from 'src/components/Dropzone'
import ExportDataModal from 'src/components/ExportDataModal'
import FloatingActionButton from 'src/components/FloatingActionButton'
import { icon, spinner } from 'src/components/icons'
import { IGVBrowser } from 'src/components/IGVBrowser'
import { IGVFileSelector } from 'src/components/IGVFileSelector'
import { DelayedSearchInput, TextInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import ModalDrawer from 'src/components/ModalDrawer'
import { notify } from 'src/components/Notifications'
import { FlexTable, HeaderCell, SimpleTable, TextCell } from 'src/components/table'
import TitleBar from 'src/components/TitleBar'
import UriViewer from 'src/components/UriViewer'
import igvLogo from 'src/images/igv-logo.png'
import wdlLogo from 'src/images/wdl-logo.png'
import { Ajax, ajaxCaller } from 'src/libs/ajax'
import { getUser } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { getConfig } from 'src/libs/config'
import { EntityDeleter, EntityUploader, ReferenceDataDeleter, ReferenceDataImporter, renderDataCell } from 'src/libs/data-utils'
import { withErrorReporting } from 'src/libs/error'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const localVariables = 'localVariables'
const bucketObjects = '__bucket_objects__'

const styles = {
  tableContainer: {
    display: 'flex', flex: 1
  },
  dataTypeSelectionPanel: {
    flex: 'none', width: 280, backgroundColor: 'white',
    boxShadow: '0 2px 5px 0 rgba(0,0,0,0.25)'
  },
  tableViewPanel: {
    position: 'relative',
    overflow: 'hidden',
    padding: '1rem', width: '100%',
    flex: 1, display: 'flex', flexDirection: 'column'
  }
}

export const ModalToolButton = ({ children, ...props }) => {
  return h(Clickable, _.merge({
    style: {
      color: colors.dark(),
      border: '1px solid transparent',
      padding: '0 0.875rem',
      backgroundColor: 'white',
      display: 'flex',
      alignItems: 'center',
      height: '3rem',
      fontSize: 18,
      userSelect: 'none'
    },
    hover: {
      border: `1px solid ${colors.accent(0.8)}`,
      boxShadow: Style.standardShadow
    }
  }, props), [children])
}

const DataTypeButton = ({ selected, children, iconName = 'listAlt', iconSize = 14, ...props }) => {
  return h(Clickable, {
    style: { ...Style.navList.item(selected), color: colors.accent() },
    hover: Style.navList.itemHover(selected),
    ...props
  }, [
    div({ style: { flex: 'none', display: 'flex', width: '1.5rem' } }, [
      icon(iconName, { size: iconSize })
    ]),
    div({ style: { flex: 1, ...Style.noWrapEllipsis } }, [
      children
    ])
  ])
}

const saveScroll = _.throttle(100, (initialX, initialY) => {
  StateHistory.update({ initialX, initialY })
})

const getReferenceData = _.flow(
  _.toPairs,
  _.filter(([key]) => key.startsWith('referenceData_')),
  _.map(([k, value]) => {
    const [, datum, key] = /referenceData_([^_]+)_(.+)/.exec(k)
    return { datum, key, value }
  }),
  _.groupBy('datum')
)

const LocalVariablesContent = class LocalVariablesContent extends Component {
  constructor(props) {
    super(props)
    this.state = {
      editIndex: undefined,
      deleteIndex: undefined,
      editKey: undefined,
      editValue: undefined,
      editType: undefined,
      textFilter: ''
    }
  }

  render() {
    const { workspace, workspace: { workspace: { namespace, name, attributes } }, refreshWorkspace, firstRender } = this.props
    const { editIndex, deleteIndex, editKey, editValue, editType, textFilter } = this.state
    const stopEditing = () => this.setState({ editIndex: undefined, editKey: undefined, editValue: undefined, editType: undefined })
    const filteredAttributes = _.flow(
      _.toPairs,
      _.remove(([key]) => key === 'description' || key.includes(':') || key.startsWith('referenceData_')),
      _.filter(data => Utils.textMatch(textFilter, _.join(' ', data))),
      _.sortBy(_.first)
    )(attributes)

    const creatingNewVariable = editIndex === filteredAttributes.length
    const amendedAttributes = [
      ...filteredAttributes, ...(creatingNewVariable ? [['', '']] : [])
    ]

    const inputErrors = editIndex && [
      ...(_.keys(_.unset(amendedAttributes[editIndex][0], attributes)).includes(editKey) ? ['Key must be unique'] : []),
      ...(!/^[\w-]*$/.test(editKey) ? ['Key can only contain letters, numbers, underscores, and dashes'] : []),
      ...(!editKey ? ['Key is required'] : []),
      ...(!editValue ? ['Value is required'] : []),
      ...(editValue && editType === 'number' && Utils.cantBeNumber(editValue) ? ['Value is not a number'] : []),
      ...(editValue && editType === 'number list' && _.some(Utils.cantBeNumber, editValue.split(',')) ?
        ['Value is not a comma-separated list of numbers'] : [])
    ]

    const saveAttribute = withErrorReporting('Error saving change to workspace variables', async originalKey => {
      const isList = editType.includes('list')
      const newBaseType = isList ? editType.slice(0, -5) : editType

      const parsedValue = isList ? _.map(Utils.convertValue(newBaseType), editValue.split(/,\s*/)) :
        Utils.convertValue(newBaseType, editValue)

      this.setState({ saving: true })

      await Ajax().Workspaces.workspace(namespace, name).shallowMergeNewAttributes({ [editKey]: parsedValue })

      if (editKey !== originalKey) {
        await Ajax().Workspaces.workspace(namespace, name).deleteAttributes([originalKey])
      }

      await refreshWorkspace()
      stopEditing()
      this.setState({ textFilter: '' })
    })

    const upload = withErrorReporting('Error uploading file', async ([file]) => {
      await Ajax().Workspaces.workspace(namespace, name).importAttributes(file)
      await refreshWorkspace()
    })

    const download = withErrorReporting('Error downloading attributes', async () => {
      const blob = await Ajax().Workspaces.workspace(namespace, name).exportAttributes()
      FileSaver.saveAs(blob, `${name}-workspace-attributes.tsv`)
    })

    const { initialY } = firstRender ? StateHistory.get() : {}
    return h(Dropzone, {
      disabled: !!Utils.editWorkspaceError(workspace),
      style: { flex: 1, display: 'flex', flexDirection: 'column' },
      activeStyle: { backgroundColor: colors.accent(0.2), cursor: 'copy' },
      onDropAccepted: upload
    }, [({ openUploader }) => h(Fragment, [
      div({ style: { flex: 'none', display: 'flex', alignItems: 'center', marginBottom: '1rem', justifyContent: 'flex-end' } }, [
        h(Link, { onClick: download }, ['Download TSV']),
        !Utils.editWorkspaceError(workspace) && h(Fragment, [
          div({ style: { whiteSpace: 'pre' } }, ['  |  Drag or click to ']),
          h(Link, { onClick: openUploader }, ['upload TSV'])
        ]),
        h(DelayedSearchInput, {
          style: { width: 300, marginLeft: '1rem' },
          placeholder: 'Search',
          onChange: v => this.setState({ textFilter: v }),
          value: textFilter
        })
      ]),
      Utils.cond(
        [_.isEmpty(amendedAttributes), () => 'No Workspace Data defined'],
        () => div({ style: { flex: 1 } }, [
          h(AutoSizer, [
            ({ width, height }) => h(FlexTable, {
              width, height, rowCount: amendedAttributes.length,
              onScroll: y => saveScroll(0, y),
              initialY,
              hoverHighlight: true,
              columns: [
                {
                  size: { basis: 400, grow: 0 },
                  headerRenderer: () => h(HeaderCell, ['Key']),
                  cellRenderer: ({ rowIndex }) => editIndex === rowIndex ?
                    h(TextInput, {
                      autoFocus: true,
                      value: editKey,
                      onChange: v => this.setState({ editKey: v })
                    }) :
                    renderDataCell(amendedAttributes[rowIndex][0], namespace)
                },
                {
                  size: { grow: 1 },
                  headerRenderer: () => h(HeaderCell, ['Value']),
                  cellRenderer: ({ rowIndex }) => {
                    const [originalKey, originalValue] = amendedAttributes[rowIndex]

                    return h(Fragment, [
                      div({ style: { flex: 1, minWidth: 0, display: 'flex' } }, [
                        editIndex === rowIndex ?
                          h(TextInput, {
                            value: editValue,
                            onChange: v => this.setState({ editValue: v })
                          }) :
                          renderDataCell(originalValue, namespace)
                      ]),
                      editIndex === rowIndex ?
                        h(Fragment, [
                          h(Select, {
                            styles: { container: base => ({ ...base, marginLeft: '1rem', width: 150 }) },
                            isSearchable: false,
                            isClearable: false,
                            menuPortalTarget: document.getElementById('root'),
                            getOptionLabel: ({ value }) => _.startCase(value),
                            value: editType,
                            onChange: ({ value }) => this.setState({ editType: value }),
                            options: ['string', 'number', 'boolean', 'string list', 'number list', 'boolean list']
                          }),
                          h(Link, {
                            tooltip: Utils.summarizeErrors(inputErrors) || 'Save changes',
                            disabled: !!inputErrors.length,
                            style: { marginLeft: '1rem' },
                            onClick: () => saveAttribute(originalKey)
                          }, [icon('success-standard', { size: 23 })]),
                          h(Link, {
                            tooltip: 'Cancel editing',
                            style: { marginLeft: '1rem' },
                            onClick: () => stopEditing()
                          }, [icon('times-circle', { size: 23 })])
                        ]) :
                        div({ className: 'hover-only' }, [
                          h(Link, {
                            disabled: !!Utils.editWorkspaceError(workspace),
                            tooltip: Utils.editWorkspaceError(workspace) || 'Edit variable',
                            style: { marginLeft: '1rem' },
                            onClick: () => this.setState({
                              editIndex: rowIndex,
                              editValue: typeof originalValue === 'object' ? originalValue.items.join(', ') : originalValue,
                              editKey: originalKey,
                              editType: typeof originalValue === 'object' ? `${typeof originalValue.items[0]} list` : typeof originalValue
                            })
                          }, [icon('edit', { size: 19 })]),
                          h(Link, {
                            disabled: !!Utils.editWorkspaceError(workspace),
                            tooltip: Utils.editWorkspaceError(workspace) || 'Delete variable',
                            style: { marginLeft: '1rem' },
                            onClick: () => this.setState({ deleteIndex: rowIndex })
                          }, [icon('trash', { size: 19 })])
                        ])
                    ])
                  }
                }
              ]
            })
          ])
        ])
      ),
      !creatingNewVariable && editIndex === undefined && !Utils.editWorkspaceError(workspace) && h(FloatingActionButton, {
        label: 'ADD VARIABLE',
        iconShape: 'plus',
        onClick: () => this.setState({
          editIndex: filteredAttributes.length,
          editValue: '',
          editKey: '',
          editType: 'string'
        })
      }),
      !!deleteIndex && h(Modal, {
        onDismiss: () => this.setState({ deleteIndex: undefined }),
        title: 'Are you sure you wish to delete this variable?',
        okButton: h(ButtonPrimary, {
          onClick: _.flow(
            withErrorReporting('Error deleting workspace variable'),
            Utils.withBusyState(v => this.setState({ saving: v }))
          )(async () => {
            this.setState({ deleteIndex: undefined })
            await Ajax().Workspaces.workspace(namespace, name).deleteAttributes([amendedAttributes[deleteIndex][0]])
            refreshWorkspace()
          })
        },
        'Delete Variable')
      }, ['This will permanently delete the data from Workspace Data.'])
    ])])
  }
}

const ReferenceDataContent = ({ workspace: { workspace: { namespace, attributes } }, referenceKey, firstRender }) => {
  const [textFilter, setTextFilter] = useState('')

  const selectedData = _.flow(
    _.filter(({ key, value }) => Utils.textMatch(textFilter, `${key} ${value}`)),
    _.sortBy('key')
  )(getReferenceData(attributes)[referenceKey])
  const { initialY } = firstRender ? StateHistory.get() : {}

  return h(Fragment, [
    h(DelayedSearchInput, {
      style: { width: 300, marginBottom: '1rem', alignSelf: 'flex-end' },
      placeholder: 'Search',
      onChange: setTextFilter,
      value: textFilter
    }),
    div({ style: { flex: 1 } }, [
      h(AutoSizer, [
        ({ width, height }) => h(FlexTable, {
          width, height, rowCount: selectedData.length,
          onScroll: y => saveScroll(0, y),
          initialY,
          columns: [
            {
              size: { basis: 400, grow: 0 },
              headerRenderer: () => h(HeaderCell, ['Key']),
              cellRenderer: ({ rowIndex }) => renderDataCell(selectedData[rowIndex].key, namespace)
            },
            {
              size: { grow: 1 },
              headerRenderer: () => h(HeaderCell, ['Value']),
              cellRenderer: ({ rowIndex }) => renderDataCell(selectedData[rowIndex].value, namespace)
            }
          ]
        })
      ])
    ])
  ])
}

const ToolDrawer = ({ openDrawer, onDismiss, onIgvSuccess, workspaceId, selectedEntities }) => {
  const [toolMode, setToolMode] = useState()
  const entitiesCount = _.keys(selectedEntities).length
  const entitiesType = !!entitiesCount && selectedEntities[_.keys(selectedEntities)[0]].entityType
  const dataExplorerUrl =
    _.size(selectedEntities) === 1 && _.values(selectedEntities)[0].attributes.data_explorer_url ?
      _.values(selectedEntities)[0].attributes.data_explorer_url :
      ''

  useEffect(() => {
    if (!openDrawer) {
      setToolMode(undefined)
    }
  }, [openDrawer])
  return h(ModalDrawer, {
    openDrawer,
    onDismiss,
    width: 450
  }, [
    Utils.switchCase(toolMode, [
      undefined, () => h(Fragment, [
        h(TitleBar, {
          title: 'OPEN WITH...',
          onDismiss
        }),
        div({ style: { display: 'flex', flexDirection: 'column', margin: '0 1.5rem' } }, [
          div({
            style: {
              borderRadius: '1rem',
              border: `1px solid ${colors.dark(0.5)}`,
              padding: '0.25rem 0.875rem',
              alignSelf: 'flex-start',
              fontSize: 12
            }
          }, [
            `${entitiesCount} ${entitiesType}s selected`
          ]),
          div({ style: { margin: '1rem 0' } }, [
            h(ModalToolButton,
              {
                onClick: () => setToolMode('IGV'),
                tooltip: 'Open with Integrative Genomics Viewer'
              }, [
                div({ style: { display: 'flex', alignItems: 'center', width: 45, marginRight: '1rem' } }, [
                  img({ src: igvLogo, style: { width: 40 } })
                ]),
                'IGV'
              ]
            ),
            h(ModalToolButton,
              {
                onClick: () => window.open(dataExplorerUrl + '&wid=' + workspaceId) /* TODO */,
                tooltip: dataExplorerUrl ? 'Open with Data Explorer' : 'Open with Data Explorer (select exactly 1 cohort)',
                style: { marginTop: '0.5rem' },
                disabled: !dataExplorerUrl
              }, [
                div({ style: { display: 'flex', alignItems: 'center', width: 45, marginRight: '1rem' } }, [
                  img({ src: '#' /* TODO */, style: { width: 40 } })
                ]),
                'Data Explorer'
              ]
            ),
            h(ModalToolButton,
              {
                tooltip: 'Open with Workflow (coming soon)',
                style: { marginTop: '0.5rem' },
                disabled: true
              }, [
                div({ style: { display: 'flex', alignItems: 'center', width: 45, marginRight: '1rem' } }, [
                  img({ src: wdlLogo, style: { height: '1rem' } })
                ]),
                'Workflow'
              ])
          ])
        ])
      ])
    ], [
      'IGV', () => h(IGVFileSelector, {
        onPrevious: () => setToolMode(undefined),
        onDismiss,
        onSuccess: onIgvSuccess,
        selectedEntities
      })
    ])
  ])
}

class EntitiesContent extends Component {
  constructor(props) {
    super(props)
    this.state = {
      selectedEntities: {},
      deletingEntities: false,
      refreshKey: 0,
      igvData: {
        selectedFiles: undefined,
        igvRefGenome: ''
      }
    }
    this.downloadForm = createRef()
  }

  renderDownloadButton(columnSettings) {
    const { workspace: { workspace: { namespace, name } }, entityKey } = this.props
    const { selectedEntities } = this.state
    const isSet = _.endsWith('_set', entityKey)
    return h(Fragment, [
      form({
        ref: this.downloadForm,
        action: `${getConfig().orchestrationUrlRoot}/cookie-authed/workspaces/${namespace}/${name}/entities/${entityKey}/tsv`,
        method: 'POST'
      }, [
        input({ type: 'hidden', name: 'FCtoken', value: getUser().token }),
        input({ type: 'hidden', name: 'attributeNames', value: _.map('name', _.filter('visible', columnSettings)).join(',') }),
        input({ type: 'hidden', name: 'model', value: 'flexible' })
      ]),
      _.isEmpty(selectedEntities) ? h(ButtonPrimary, {
        style: { marginRight: '1rem' },
        tooltip: 'Download all data as a file',
        onClick: () => this.downloadForm.current.submit()
      }, [
        icon('download', { style: { marginRight: '0.5rem' } }),
        'Download Table TSV'
      ]) : h(ButtonPrimary, {
        style: { marginRight: '1rem' },
        disabled: _.isEmpty(selectedEntities),
        tooltip: 'Download selected data as a file',
        onClick: async () => {
          const tsv = this.buildTSV(columnSettings, selectedEntities)
          isSet ?
            FileSaver.saveAs(await tsv, `${entityKey}.zip`) :
            FileSaver.saveAs(new Blob([tsv], { type: 'text/tab-separated-values' }), `${entityKey}.tsv`)
        }
      }, [
        icon('download', { style: { marginRight: '0.5rem' } }),
        `Download Selected TSV (${_.size(selectedEntities)})`
      ])
    ])
  }

  renderCopyButton(entities, columnSettings) {
    const { copying } = this.state

    return h(Fragment, [
      h(ButtonPrimary, {
        style: { marginRight: '1rem' },
        tooltip: 'Copy only the current page to the clipboard',
        onClick: _.flow(
          withErrorReporting('Error copying to clipboard'),
          Utils.withBusyState(v => this.setState({ copying: v }))
        )(async () => {
          const str = this.buildTSV(columnSettings, entities)
          await clipboard.writeText(str)
          notify('success', 'Successfully copied to clipboard', { timeout: 3000 })
        })
      }, [
        icon('copy-to-clipboard', { style: { marginRight: '0.5rem' } }),
        'Copy to Clipboard'
      ]),
      copying && spinner()
    ])
  }

  renderToolButton() {
    const { selectedEntities } = this.state

    return h(ButtonPrimary, {
      style: { marginRight: '1rem' },
      disabled: _.isEmpty(selectedEntities),
      tooltip: 'Open the selected data',
      onClick: () => this.setState({ showToolSelector: true })
    }, [
      'Open with...'
    ])
  }

  buildTSV(columnSettings, entities) {
    const { entityKey } = this.props
    const sortedEntities = _.sortBy('name', entities)
    const isSet = _.endsWith('_set', entityKey)
    const setRoot = entityKey.slice(0, -4)
    const attributeNames = _.flow(
      _.filter('visible'),
      _.map('name'),
      isSet ? _.without([`${setRoot}s`]) : _.identity
    )(columnSettings)

    const entityToRow = entity => _.join('\t', [
      entity.name, ..._.map(
        attribute => Utils.entityAttributeText(entity.attributes[attribute], true),
        attributeNames)
    ])

    const header = _.join('\t', [`entity:${entityKey}_id`, ...attributeNames])

    const entityTsv = _.join('\n', [header, ..._.map(entityToRow, sortedEntities)]) + '\n'

    if (isSet) {
      const entityToMembership = ({ attributes, name }) => _.map(
        ({ entityName }) => `${name}\t${entityName}`,
        attributes[`${setRoot}s`].items
      )

      const header = `membership:${entityKey}_id\t${setRoot}`

      const membershipTsv = _.join('\n', [header, ..._.flatMap(entityToMembership, sortedEntities)]) + '\n'

      const zipFile = new JSZip()
        .file(`${entityKey}_entity.tsv`, entityTsv)
        .file(`${entityKey}_membership.tsv`, membershipTsv)

      return zipFile.generateAsync({ type: 'blob' })
    } else {
      return entityTsv
    }
  }

  render() {
    const {
      workspace, workspace: { workspace: { namespace, name }, workspaceSubmissionStats: { runningSubmissionsCount } },
      entityKey, entityMetadata, loadMetadata, firstRender
    } = this.props
    const { selectedEntities, deletingEntities, copyingEntities, refreshKey, showToolSelector, igvData: { selectedFiles, refGenome } } = this.state

    const { initialX, initialY } = firstRender ? StateHistory.get() : {}

    return selectedFiles ? h(IGVBrowser, { selectedFiles, refGenome, namespace }) : h(Fragment, [
      h(DataTable, {
        persist: true, firstRender, refreshKey,
        entityType: entityKey, entityMetadata, workspaceId: { namespace, name },
        onScroll: saveScroll, initialX, initialY,
        selectionModel: {
          type: 'multiple',
          selected: selectedEntities,
          setSelected: e => this.setState({ selectedEntities: e })
        },
        childrenBefore: ({ entities, columnSettings }) => div({
          style: { display: 'flex', alignItems: 'center', flex: 'none' }
        }, [
          this.renderDownloadButton(columnSettings),
          !_.endsWith('_set', entityKey) && this.renderCopyButton(entities, columnSettings),
          this.renderToolButton()
        ])
      }),
      !_.isEmpty(selectedEntities) && h(FloatingActionButton, {
        label: 'COPY DATA',
        iconShape: 'copy',
        bottom: 80,
        onClick: () => this.setState({ copyingEntities: true })
      }),
      !_.isEmpty(selectedEntities) && !Utils.editWorkspaceError(workspace) && h(FloatingActionButton, {
        label: 'DELETE DATA',
        iconShape: 'trash',
        onClick: () => this.setState({ deletingEntities: true })
      }),
      deletingEntities && h(EntityDeleter, {
        onDismiss: () => this.setState({ deletingEntities: false }),
        onSuccess: () => {
          this.setState({ deletingEntities: false, selectedEntities: {}, refreshKey: refreshKey + 1 })
          loadMetadata()
        },
        namespace, name,
        selectedEntities: _.keys(selectedEntities), selectedDataType: entityKey, runningSubmissionsCount
      }),
      copyingEntities && h(ExportDataModal, {
        onDismiss: () => this.setState({ copyingEntities: false }),
        workspace,
        selectedEntities: _.keys(selectedEntities), selectedDataType: entityKey, runningSubmissionsCount
      }),
      h(ToolDrawer, {
        openDrawer: showToolSelector,
        onDismiss: () => this.setState({ showToolSelector: false }),
        onIgvSuccess: newIgvData => this.setState({ showToolSelector: false, igvData: newIgvData }),
        workspaceId: { namespace, name },
        selectedEntities
      })
    ])
  }
}

const DeleteObjectModal = ({ name, workspace: { workspace: { namespace, bucketName } }, onSuccess, onDismiss }) => {
  const [deleting, setDeleting] = useState(false)

  const doDelete = _.flow(
    withErrorReporting('Error deleting object'),
    Utils.withBusyState(setDeleting)
  )(async () => {
    await Ajax().Buckets.delete(namespace, bucketName, name)
    onSuccess()
  })

  return h(Modal, {
    onDismiss,
    okButton: doDelete,
    title: 'Delete this file?'
  }, [
    'Are you sure you want to delete this file from the Google bucket?',
    deleting && spinnerOverlay
  ])
}

const BucketContent = _.flow(
  ajaxCaller,
  requesterPaysWrapper({ onDismiss: ({ onClose }) => onClose() })
)(class BucketContent extends Component {
  constructor(props) {
    super(props)
    const { prefix = '', objects } = props.firstRender ? StateHistory.get() : {}
    this.state = {
      prefix,
      objects,
      deletingName: undefined,
      viewingName: undefined
    }
  }

  componentDidMount() {
    this.load()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.refreshKey !== this.props.refreshKey) {
      this.load('')
    }
    StateHistory.update(_.pick(['objects', 'prefix'], this.state))
  }

  load = _.flow(
    withRequesterPaysHandler(this.props.onRequesterPaysError),
    withErrorReporting('Error loading bucket data'),
    Utils.withBusyState(v => this.setState({ loading: v }))
  )(async (prefix = this.state.prefix) => {
    const { workspace: { workspace: { namespace, bucketName } }, ajax: { Buckets } } = this.props
    const { items, prefixes } = await Buckets.list(namespace, bucketName, prefix)
    this.setState({ objects: items, prefixes, prefix })
  })

  uploadFiles = _.flow(
    withErrorReporting('Error uploading file'),
    Utils.withBusyState(v => this.setState({ uploading: v }))
  )(async files => {
    const { workspace: { workspace: { namespace, bucketName } } } = this.props
    const { prefix } = this.state
    await Ajax().Buckets.upload(namespace, bucketName, prefix, files[0])
    this.load()
  })

  render() {
    const { workspace, workspace: { workspace: { namespace, bucketName } } } = this.props
    const { prefix, prefixes, objects, loading, uploading, deletingName, viewingName } = this.state
    const prefixParts = _.dropRight(1, prefix.split('/'))
    const makeBucketLink = ({ label, target, onClick }) => h(Link, {
      style: { textDecoration: 'underline' },
      href: `gs://${bucketName}/${target}`,
      onClick: e => {
        e.preventDefault()
        onClick()
      }
    }, [label])

    return h(Dropzone, {
      disabled: !!Utils.editWorkspaceError(workspace),
      style: { flexGrow: 1, backgroundColor: 'white', border: `1px solid ${colors.dark(0.55)}`, padding: '1rem' },
      activeStyle: { backgroundColor: colors.accent(0.2), cursor: 'copy' },
      onDropAccepted: files => this.uploadFiles(files)
    }, [({ openUploader }) => h(Fragment, [
      div([
        _.map(({ label, target }) => {
          return h(Fragment, { key: target }, [
            makeBucketLink({ label, target, onClick: () => this.load(target) }),
            ' / '
          ])
        }, [
          { label: 'Files', target: '' },
          ..._.map(n => {
            return { label: prefixParts[n], target: _.map(s => `${s}/`, _.take(n + 1, prefixParts)).join('') }
          }, _.range(0, prefixParts.length))
        ])
      ]),
      div({ style: { margin: '1rem -1rem 1rem -1rem', borderBottom: `1px solid ${colors.dark(0.25)}` } }),
      h(SimpleTable, {
        columns: [
          { size: { basis: 24, grow: 0 }, key: 'button' },
          { header: h(HeaderCell, ['Name']), size: { grow: 1 }, key: 'name' },
          { header: h(HeaderCell, ['Size']), size: { basis: 200, grow: 0 }, key: 'size' },
          { header: h(HeaderCell, ['Last modified']), size: { basis: 200, grow: 0 }, key: 'updated' }
        ],
        rows: [
          ..._.map(p => {
            return {
              name: h(TextCell, [
                makeBucketLink({
                  label: p.slice(prefix.length),
                  target: `gs://${bucketName}/${p}`,
                  onClick: () => this.load(p)
                })
              ])
            }
          }, prefixes),
          ..._.map(({ name, size, updated }) => {
            return {
              button: h(Link, {
                style: { display: 'flex' }, onClick: () => this.setState({ deletingName: name }),
                tooltip: 'Delete file'
              }, [
                icon('trash', { size: 16, className: 'hover-only' })
              ]),
              name: h(TextCell, [
                makeBucketLink({
                  label: name.slice(prefix.length),
                  target: `gs://${bucketName}/${name}`,
                  onClick: () => this.setState({ viewingName: name })
                })
              ]),
              size: filesize(size, { round: 0 }),
              updated: Utils.makePrettyDate(updated)
            }
          }, objects)
        ]
      }),
      deletingName && h(DeleteObjectModal, {
        workspace, name: deletingName,
        onDismiss: () => this.setState({ deletingName: undefined }),
        onSuccess: () => {
          this.setState({ deletingName: undefined })
          this.load()
        }
      }),
      viewingName && h(UriViewer, {
        googleProject: namespace, uri: `gs://${bucketName}/${viewingName}`,
        onDismiss: () => this.setState({ viewingName: undefined })
      }),
      !Utils.editWorkspaceError(workspace) && h(FloatingActionButton, {
        label: 'UPLOAD',
        iconShape: 'plus',
        onClick: openUploader
      }),
      (loading || uploading) && spinnerOverlay
    ])])
  }
})

const WorkspaceData = _.flow(
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Data', activeTab: 'data'
  }),
  ajaxCaller
)(class WorkspaceData extends Component {
  constructor(props) {
    super(props)
    const { selectedDataType, entityMetadata } = StateHistory.get()
    this.state = {
      firstRender: true,
      refreshKey: 0,
      selectedDataType,
      entityMetadata,
      importingReference: false,
      deletingReference: undefined
    }
  }

  loadMetadata = withErrorReporting('Error loading workspace entity data', async () => {
    const { namespace, name, ajax: { Workspaces } } = this.props
    const { selectedDataType } = this.state
    const entityMetadata = await Workspaces.workspace(namespace, name).entityMetadata()
    this.setState({
      selectedDataType: this.selectionType() === 'entities' && !entityMetadata[selectedDataType] ? undefined : selectedDataType,
      entityMetadata
    })
  })

  componentDidMount() {
    this.loadMetadata()
    this.setState({ firstRender: false })
  }

  refresh() {
    this.setState(({ refreshKey }) => ({ refreshKey: refreshKey + 1 }))
  }

  selectionType() {
    const { workspace: { workspace: { attributes } } } = this.props
    const { selectedDataType } = this.state
    const referenceData = getReferenceData(attributes)
    return Utils.cond(
      [!selectedDataType, () => 'none'],
      [selectedDataType === localVariables, () => 'localVariables'],
      [selectedDataType === bucketObjects, () => 'bucketObjects'],
      [_.includes(selectedDataType, _.keys(referenceData)), () => 'referenceData'],
      () => 'entities'
    )
  }

  render() {
    const { namespace, name, workspace, workspace: { workspace: { attributes } }, refreshWorkspace } = this.props
    const { selectedDataType, entityMetadata, importingReference, deletingReference, firstRender, refreshKey, uploadingFile } = this.state
    const referenceData = getReferenceData(attributes)

    return div({ style: styles.tableContainer }, [
      !entityMetadata ? spinnerOverlay : h(Fragment, [
        div({ style: styles.dataTypeSelectionPanel }, [
          div({ style: Style.navList.heading }, [
            div(['Tables']),
            h(Link, {
              disabled: !!Utils.editWorkspaceError(workspace),
              tooltip: Utils.editWorkspaceError(workspace) || 'Upload .tsv',
              onClick: () => this.setState({ uploadingFile: true })
            }, [icon('plus-circle', { size: 21 })])
          ]),
          _.map(([type, typeDetails]) => {
            return h(DataTypeButton, {
              key: type,
              selected: selectedDataType === type,
              onClick: () => {
                this.setState({ selectedDataType: type, refreshKey: refreshKey + 1 })
              }
            }, [`${type} (${typeDetails.count})`])
          }, _.toPairs(entityMetadata)),
          div({ style: Style.navList.heading }, [
            div(['Reference Data']),
            h(Link, {
              disabled: !!Utils.editWorkspaceError(workspace),
              tooltip: Utils.editWorkspaceError(workspace) || 'Add reference data',
              onClick: () => this.setState({ importingReference: true })
            }, [icon('plus-circle', { size: 21 })])
          ]),
          importingReference && h(ReferenceDataImporter, {
            onDismiss: () => this.setState({ importingReference: false }),
            onSuccess: () => this.setState({ importingReference: false }, refreshWorkspace),
            namespace, name
          }),
          deletingReference && h(ReferenceDataDeleter, {
            onDismiss: () => this.setState({ deletingReference: false }),
            onSuccess: () => this.setState({
              deletingReference: false,
              selectedDataType: selectedDataType === deletingReference ? undefined : selectedDataType
            }, refreshWorkspace),
            namespace, name, referenceDataType: deletingReference
          }),
          uploadingFile && h(EntityUploader, {
            onDismiss: () => this.setState({ uploadingFile: false }),
            onSuccess: () => this.setState({ uploadingFile: false }, () => {
              this.loadMetadata()
              this.refresh()
            }),
            namespace, name,
            entityTypes: _.keys(entityMetadata)
          }),
          _.map(type => {
            return h(DataTypeButton, {
              key: type,
              selected: selectedDataType === type,
              onClick: () => {
                this.setState({ selectedDataType: type })
                refreshWorkspace()
              }
            }, [
              div({ style: { display: 'flex', justifyContent: 'space-between' } }, [
                type,
                h(Link, {
                  disabled: !!Utils.editWorkspaceError(workspace),
                  tooltip: Utils.editWorkspaceError(workspace) || `Delete ${type}`,
                  onClick: e => {
                    e.stopPropagation()
                    this.setState({ deletingReference: type })
                  }
                }, [icon('minus-circle', { size: 16 })])
              ])
            ])
          }, _.keys(referenceData)),
          div({ style: Style.navList.heading }, 'Other Data'),
          h(DataTypeButton, {
            selected: selectedDataType === localVariables,
            onClick: () => {
              this.setState({ selectedDataType: localVariables })
              refreshWorkspace()
            }
          }, ['Workspace Data']),
          h(DataTypeButton, {
            iconName: 'folder', iconSize: 18,
            selected: selectedDataType === bucketObjects,
            onClick: () => {
              this.setState({ selectedDataType: bucketObjects, refreshKey: refreshKey + 1 })
            }
          }, ['Files'])
        ]),
        div({ style: styles.tableViewPanel }, [
          Utils.switchCase(this.selectionType(),
            ['none', () => div({ style: { textAlign: 'center' } }, ['Select a data type'])],
            ['localVariables', () => h(LocalVariablesContent, {
              workspace,
              refreshWorkspace,
              firstRender
            })],
            ['referenceData', () => h(ReferenceDataContent, {
              key: selectedDataType,
              workspace,
              referenceKey: selectedDataType,
              firstRender
            })],
            ['bucketObjects', () => h(BucketContent, {
              workspace, onClose: () => this.setState({ selectedDataType: undefined }),
              firstRender, refreshKey
            })],
            ['entities', () => h(EntitiesContent, {
              key: selectedDataType,
              workspace,
              entityMetadata,
              entityKey: selectedDataType,
              loadMetadata: () => this.loadMetadata(),
              firstRender, refreshKey
            })]
          )
        ])
      ])
    ])
  }

  componentDidUpdate() {
    StateHistory.update(_.pick(['entityMetadata', 'selectedDataType'], this.state))
  }
})

export const navPaths = [
  {
    name: 'workspace-data',
    path: '/workspaces/:namespace/:name/data',
    component: WorkspaceData,
    title: ({ name }) => `${name} - Data`
  }
]
