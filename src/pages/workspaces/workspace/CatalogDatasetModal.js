import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { div, h, span } from 'react-hyperscript-helpers'
import { IdContainer, LabeledCheckbox, RadioButton } from 'src/components/common'
import { IntegerInput, TextInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import { FormLabel } from 'src/libs/forms'
import SimpleMDE from 'react-simplemde-editor'


const CatalogDatasetModal = ({ onDismiss, workspace }) => {
  const [datasetName, setDatasetName] = useState('')
  const [datasetVersion, setDatasetVersion] = useState('')
  const [datasetDescription, setDatasetDescription] = useState('')
  const [datasetCustodian, setDatasetCustodian] = useState('')
  const [datasetDepositor, setDatsetDespositor] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [datasetOwner, setDatasetOwner] = useState('')
  const [institute, setInstitute] = useState([])
  const [indication, setIndication] = useState('')
  const [primaryDiseaseSite, setPrimaryDiseaseSite] = useState('')
  const [numSubjects, setNumSubjects] = useState(0)
  const [projectName, setProjectName] = useState('')
  const [dataCategory, setDataCategory] = useState([])
  const [dataType, setDataType] = useState([])
  const [reference, setReference] = useState('')
  const [dataFileFormats, setDataFileFormats] = useState('')
  const [technology, setTechnology] = useState('')
  const [profilingProtocol, setProfilingProtocol] = useState('')
  const [coverage, setCoverage] = useState('')
  const [dataUseRestriction, setDataUseRestriction] = useState('')
  const [studyDesign, setStudyDesign] = useState('')
  const [cellType, setCellType] = useState('')
  const [ethnicity, setEthnicity] = useState('')
  const [cohortCountry, setCohortCountry] = useState('')
  const [requiresExternalApproval, setRequiresExternalApproval] = useState(false)
  const [dataAccessInstructions, setDataAccessInstructions] = useState('')
  const [useLimitationOption, setUseLimitationOption] = useState('')

  const makeTextInput = (inputLabel, value, onChange, isRequired = false) => h(IdContainer, [
    id => h(Fragment, [
      h(FormLabel, { htmlFor: id, isRequired }, [inputLabel]),
      h(TextInput, { value, onChange })
    ])
  ])

  const makeBooleanInput = (inputLabel, checked, onChange) => h(FormLabel, [
    h(LabeledCheckbox, { checked, onChange }, [span({
      style: { paddingLeft: '0.5rem' }
    }, [inputLabel])])
  ])

  const makeIntInput = (inputLabel, min, value, onChange, isRequired = false) => h(IdContainer, [
    id => h(Fragment, [
      h(FormLabel, { htmlFor: id, isRequired }, [inputLabel]),
      h(IntegerInput, { min, value, onChange })
    ])
  ])

  const makeRadioInput = (inputLabel, value, options, onChange, isRequired = false) => div([
    h(FormLabel, { isRequired }, [inputLabel]),
    h(Fragment, _.map(({ optLabel, optValue }) => div([h(RadioButton, {
      onChange: () => onChange(optValue),
      checked: value === optValue,
      text: optLabel
    })]), options))
  ])

  return h(Modal, {
    onDismiss,
    title: 'Catalog Dataset',
    width: '40rem'
  }, [
    makeTextInput('Cohort Name', datasetName, setDatasetName, true),
    makeTextInput('Dataset Version', datasetVersion, setDatasetVersion, true),
    makeTextInput('Cohort Description', datasetDescription, setDatasetDescription, true),
    makeTextInput('Dataset Owner', datasetOwner, setDatasetOwner, true),
    makeTextInput('Dataset Custodian', datasetCustodian, setDatasetCustodian, true),
    makeTextInput('Dataset Depositor', datasetDepositor, setDatsetDespositor, true),
    makeTextInput('Contact Email', contactEmail, setContactEmail, true),
    makeTextInput('Research Institute', institute, setInstitute, true),
    makeTextInput('Cohort Phenotype/Indication', indication, setIndication, true),
    makeTextInput('Primary Disease Site', primaryDiseaseSite, setPrimaryDiseaseSite),
    makeIntInput('No. of Subjects', 0, numSubjects, setNumSubjects, true),
    makeTextInput('Project Name', projectName, setProjectName, true),
    makeTextInput('Data Category', dataCategory, setDataCategory, true),
    makeTextInput('Experimental Strategy', dataType, setDataType, true),
    makeTextInput('Genome Reference Version', reference, setReference),
    makeTextInput('Data File Formats', dataFileFormats, setDataFileFormats),
    makeTextInput('Profiling instrument type', technology, setTechnology),
    makeTextInput('Profiling Protocol', profilingProtocol, setProfilingProtocol),
    makeTextInput('Depth of Sequencing Coverage (Average)', coverage, setCoverage),
    makeTextInput('Data Use Limitation', dataUseRestriction, setDataUseRestriction, true),
    makeTextInput('Study Design', studyDesign, setStudyDesign, true),
    makeTextInput('Cell Type', cellType, setCellType),
    makeTextInput('Reported Ethnicity', ethnicity, setEthnicity),
    makeTextInput('Cohort Country of Origin', cohortCountry, setCohortCountry),
    makeBooleanInput('Requires External Approval', requiresExternalApproval, setRequiresExternalApproval),
    h(FormLabel, ['Data Access Instructions']),
    div({ style: { fontSize: 'smaller' } }, [
      'Users will see this message when attempting to access a workspace they are unauthorized to enter. Leave blank for a default message with the Contact Email above.'
    ]),
    h(SimpleMDE, {
      options: { renderingConfig: { singleLineBreaks: false } },
      value: dataAccessInstructions,
      className: 'simplemde-container',
      onChange: setDataAccessInstructions
    }),
    makeRadioInput('Choose one of the available options to define Data Use Limitations', useLimitationOption, [
      { optValue: '', optLabel: 'Not specified' },
      { optValue: 'questionnaire', optLabel: 'Set Data Use Limitations by answering a questionnaire' },
      { optValue: 'orsp', optLabel: 'Retrieve Data Use Limitations from Broad ORSP' },
      { optValue: 'skip', optLabel: 'I would like to skip this step' }
    ], setUseLimitationOption)

  ])
}

export default CatalogDatasetModal
