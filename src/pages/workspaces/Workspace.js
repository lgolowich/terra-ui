import _ from 'lodash/fp'
// import * as Utils from 'src/libs/utils'
import { WorkspaceDashboard } from 'src/pages/workspaces/workspace/Dashboard'
import { h } from 'react-hyperscript-helpers'


export const Workspace = ({ tab, ...rawProps }) => {
  const { namespace, name } = rawProps
  const props = { key: `${namespace}/${name}`, ...rawProps }
  switch (tab) {
    default:
      return h(WorkspaceDashboard, props)
  }
}

export const navPaths = [
  {
    name: 'workspace-dashboard',
    path: '/workspaces/:namespace/:name/:tab?',
    component: Workspace,
    title: ({ name, tab }) => `${name} - ${_.startCase(tab || 'dashboard')}`
  }
  // , {
  //   name: 'workspace',
  //   path: '/workspaces/:namespace/:name/:tab?',
  //   component: Workspace,
  //   title: ({ name, tab }) => `${name} - ${_.startCase(tab || 'notebooks')}`
  // }
//   {
//     name: 'workspace-notebooks',
//     path: '/workspaces/:namespace/:name/notebooks',
//     component: Notebooks,
//     title: ({ name }) => `${name} - Notebooks`
//   },
//   {
//     name: 'workspace-job-history',
//     path: '/workspaces/:namespace/:name/job_history',
//     component: JobHistory,
//     title: ({ name }) => `${name} - Job History`
//   },
//   {
//     name: 'workspace-data',
//     path: '/workspaces/:namespace/:name/data',
//     component: WorkspaceData,
//     title: ({ name }) => `${name} - Data`
//   },
//   {
//     name: 'workspace-dashboard',
//     path: '/workspaces/:namespace/:name',
//     component: WorkspaceDashboard,
//     title: ({ name }) => `${name} - Dashboard`
//   }
// These paths need more than just tab name
//     {
//     name: 'workspace-submission-details',
//     path: '/workspaces/:namespace/:name/job_history/:submissionId',
//     component: SubmissionDetails,
//     title: ({ name }) => `${name} - Submission Details`
//   }, {
//     name: 'workspace-notebook-launch',
//     path: '/workspaces/:namespace/:name/notebooks/launch/:notebookName',
//     component: NotebookLauncher,
//     title: ({ name, notebookName }) => `${notebookName} - ${name}`
//   }, {
//     name: 'workspace-terminal-launch',
//     path: '/workspaces/:namespace/:name/notebooks/terminal',
//     component: TerminalLauncher,
//     title: ({ name }) => `${name} - Terminal`
//   }, {
//     name: 'workflow',
//     path: '/workspaces/:namespace/:name/tools/:workflowNamespace/:workflowName',
//     component: WorkflowView,
//     title: ({ name, workflowName }) => `${name} - Tools - ${workflowName}`
//   }
]

