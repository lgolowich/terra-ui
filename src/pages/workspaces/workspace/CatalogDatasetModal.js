import { Fragment, useState } from 'react'
import { h, span } from 'react-hyperscript-helpers'
import { IdContainer, LabeledCheckbox } from 'src/components/common'
import { IntegerInput, TextInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import { FormLabel } from 'src/libs/forms'


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
  const [numSubjects, setNumSubjects] = useState(0)
  const [projectName, setProjectName] = useState('')
  const [dataCategory, setDataCategory] = useState([])
  const [dataType, setDataType] = useState([])
  const [dataUseRestriction, setDataUseRestriction] = useState('')
  const [studyDesign, setStudyDesign] = useState('')
  const [requiresExternalApproval, setRequiresExternalApproval] = useState(false)
  const [useLimitationOption, setUseLimitationOption] = useState('')

  const makeTextInput = (inputLabel, value, onChange) => h(IdContainer, [
    id => h(Fragment, [
      h(FormLabel, { htmlFor: id }, [inputLabel]),
      h(TextInput, { value, onChange })
    ])
  ])

  const makeBooleanInput = (inputLabel, checked, onChange) => h(FormLabel, [
    h(LabeledCheckbox, { checked, onChange }, [span({
      style: { paddingLeft: '0.5rem' }
    }, [inputLabel])])
  ])

  const makeIntInput = (inputLabel, min, value, onChange) => h(IdContainer, [
    id => h(Fragment, [
      h(FormLabel, { htmlFor: id }, [inputLabel]),
      h(IntegerInput, { min, value, onChange })
    ])
  ])

  return h(Modal, {
    onDismiss,
    title: 'Catalog Dataset'
  }, [
    makeTextInput('Cohort Name', datasetName, setDatasetName),
    makeTextInput('Dataset Version', datasetVersion, setDatasetVersion),
    makeTextInput('Cohort Description', datasetDescription, setDatasetDescription),
    makeTextInput('Dataset Custodian', datasetCustodian, setDatasetCustodian),
    makeTextInput('Dataset Depositor', datasetDepositor, setDatsetDespositor),
    makeTextInput('Contact Email', contactEmail, setContactEmail),
    makeTextInput('Dataset Owner', datasetOwner, setDatasetOwner),
    makeTextInput('Research Institute', institute, setInstitute),
    makeTextInput('Cohort Phenotype/Indication', indication, setIndication),
    makeIntInput('No. of Subjects', 0, numSubjects, setNumSubjects),
    makeTextInput('Project Name', projectName, setProjectName),
    makeTextInput('Data Category', dataCategory, setDataCategory),
    makeTextInput('Experimental Strategy', dataType, setDataType),
    makeTextInput('Data Use Limitation', dataUseRestriction, setDataUseRestriction),
    makeTextInput('Study Design', studyDesign, setStudyDesign),
    makeBooleanInput('Requires External Approval', requiresExternalApproval, setRequiresExternalApproval),
    makeTextInput('Choose one of the available options to define Data Use Limitations', useLimitationOption, setUseLimitationOption)

  ])
}

export default CatalogDatasetModal
