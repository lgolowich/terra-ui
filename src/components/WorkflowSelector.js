import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { centeredSpinner } from 'src/components/icons'
import { Ajax, useCancellation } from 'src/libs/ajax'
import { withErrorReporting } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import { workflowSelectionStore } from 'src/libs/state'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { ModalToolButton } from 'src/pages/workspaces/workspace/Data'


const WorkflowSelector = ({ workspace: { workspace: { namespace, name } }, selectedEntities }) => {
  const { Workspaces } = Ajax(useCancellation())
  const [loading, setLoading] = useState()
  const [configs, setConfigs] = useState()
  const selectionKey = Utils.useUniqueId()

  Utils.useOnMount(() => {
    const loadWorkflows = _.flow(
      withErrorReporting('Error loading configs'),
      Utils.withBusyState(setLoading)
    )(async () => setConfigs(await Workspaces.workspace(namespace, name).listMethodConfigs()))

    workflowSelectionStore.set({
      key: selectionKey,
      entityType: _.values(selectedEntities)[0].entityType,
      entities: selectedEntities
    })

    loadWorkflows()
  })

  const makeWfCard = ({ namespace: workflowNamespace, name: workflowName }) => h(ModalToolButton, {
    href: `${Nav.getLink('workflow', { namespace, name, workflowNamespace, workflowName })}?selectionKey=${selectionKey}`,
    style: { marginBottom: '1rem', height: 50, flex: 'none' }
  }, [div({ style: Style.elements.card.title }, [workflowName])])

  return div({ style: { ...Style.modalDrawer.content, overflowY: 'auto' } }, [
    loading ?
      centeredSpinner() :
      h(Fragment, _.map(makeWfCard, configs))
  ])
}

export default WorkflowSelector
