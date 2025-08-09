import bcrypt from 'bcryptjs'

export const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(12)
    return await bcrypt.hash(password, salt)
  } catch (error) {
    throw new Error('Password hashing failed')
  }
}

export const comparePassword = async (candidatePassword, hashedPassword) => {
  try {
    return await bcrypt.compare(candidatePassword, hashedPassword)
  } catch (error) {
    throw new Error('Password comparison failed')
  }
}
