import * as yup from 'yup'

const emailField = yup
  .string()
  .trim()
  .email('Enter a valid email')
  .required('Email is required')

const passwordField = yup
  .string()
  .min(6, 'Password must be at least 6 characters')
  .required('Password is required')

export const loginSchema = yup.object({
  email: emailField,
  password: yup.string().required('Password is required'),
})

export const partnerSchema = yup.object({
  companyName: yup.string().trim().required('Company name is required'),
  email: emailField,
  password: passwordField,
  confirmPassword: yup
    .string()
    .required('Confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
  logo: yup
    .mixed()
    .nullable()
    .test(
      'fileType',
      'Logo must be an image',
      (file) => !file || (typeof File !== 'undefined' && file instanceof File && file.type.startsWith('image/')),
    )
    .test(
      'fileSize',
      'Logo must be 5MB or smaller',
      (file) => !file || file.size <= 5 * 1024 * 1024,
    ),
})

const partnerLogoField = yup
  .mixed()
  .nullable()
  .test(
    'fileType',
    'Logo must be an image',
    (file) => !file || (typeof File !== 'undefined' && file instanceof File && file.type.startsWith('image/')),
  )
  .test(
    'fileSize',
    'Logo must be 5MB or smaller',
    (file) => !file || file.size <= 5 * 1024 * 1024,
  )

export const partnerCreateSchema = partnerSchema

export const partnerUpdateSchema = yup.object({
  companyName: yup.string().trim().required('Company name is required'),
  email: emailField,
  password: yup
    .string()
    .test('optional-min', 'Password must be at least 6 characters', (value) => !value || value.length >= 6),
  confirmPassword: yup.string().when('password', {
    is: (value) => Boolean(value),
    then: (schema) => schema.required('Confirm your password').oneOf([yup.ref('password')], 'Passwords must match'),
    otherwise: (schema) => schema.strip(),
  }),
  logo: partnerLogoField,
})

export const loginInitialValues = {
  email: '',
  password: '',
}

export const partnerInitialValues = {
  companyName: '',
  email: '',
  password: '',
  confirmPassword: '',
  logo: null,
}

const staffNameFields = {
  firstName: yup.string().trim().required('First name is required'),
  middleName: yup.string().trim(),
  lastName: yup.string().trim().required('Last name is required'),
  email: emailField,
}

export const staffCreateSchema = yup.object({
  ...staffNameFields,
  password: passwordField,
  confirmPassword: yup
    .string()
    .required('Confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
})

export const staffUpdateSchema = yup.object({
  ...staffNameFields,
  password: yup
    .string()
    .test('optional-min', 'Password must be at least 6 characters', (value) => !value || value.length >= 6),
  confirmPassword: yup.string().when('password', {
    is: (value) => Boolean(value),
    then: (schema) => schema.required('Confirm your password').oneOf([yup.ref('password')], 'Passwords must match'),
    otherwise: (schema) => schema.strip(),
  }),
})

export const staffInitialValues = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export const paperSizeSchema = yup.object({
  name: yup.string().trim().required('Paper size is required'),
  width: yup
    .number()
    .typeError('Enter a width')
    .positive('Width must be greater than 0')
    .required('Width is required'),
  height: yup
    .number()
    .typeError('Enter a height')
    .positive('Height must be greater than 0')
    .required('Height is required'),
  unit: yup.string().oneOf(['mm', 'in']).required('Unit is required'),
  priceBw: yup
    .number()
    .typeError('Enter a B&W price')
    .min(0, 'Price cannot be negative')
    .required('B&W price is required'),
  priceColor: yup
    .number()
    .typeError('Enter a color price')
    .min(0, 'Price cannot be negative')
    .required('Color price is required'),
})

export const paperSizeInitialValues = {
  name: '',
  width: '',
  height: '',
  unit: 'mm',
  priceBw: '',
  priceColor: '',
}
