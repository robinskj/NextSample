'use server';
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { nameRegex } from './definitions';
 

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export type CustomerState = {
  errors?: {
    name?: string[];
    email?: string[];
    url?: string[];
  };
  message?: string | null;
};
 /*********** Customers ***********/
const customerSchema = z.object({
    name: z.string({ required_error : 'Name is a required field'})
          .min(1, { message: 'Name must contain at least 1 character.'})
          .refine((value) => nameRegex.test(value), { message: `Name can only have valid characters.`}),
    email: z.string({ invalid_type_error: 'Invalid Email', }).optional(),
    url: z.string()
        .refine((value) => /^(https?):\/\/(?=.*\.[a-z]{2,})[^\s$.?#].[^\s]*$/i.test(value), {
          message: 'Please enter a valid URL',
        }).optional(),
  })
     
export default async function createCustomer(prevState: CustomerState, formData: FormData) {
  const validatedFields = customerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    url: formData.get('url')
  })
 
  // Return early if the form data is invalid
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }
  const { name, email, url } = validatedFields.data;
  // Mutate data
  try {
    await sql`
      INSERT INTO customers (customer_id, name, url )
      VALUES (${email}, ${name}, ${url})
    `;
  } catch (error) {
    return {
      message: 'Database Error: Failed to Create Customer.',
    };
  }
  revalidatePath('/dashboard/customers');
  redirect('/dashboard/customers');

}
export async function updateCustomer(id: string, prevState: CustomerState, formData:FormData) {
  const validatedFields = customerSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    url: formData.get('url'),
  });
  
  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Customer.',
    };
  }
  const { email, name, url } = validatedFields.data;
 
  try {
    await sql`
      UPDATE customers
      SET customer_id = ${email}, name = ${name}, url = ${url}
      WHERE id = ${email}
    `;
  } catch (error) {
    return { message:  `Database Error: Failed to update Customer ${name}`};
  }

  revalidatePath('/dashboard/customers');
  redirect('/dashboard/customers');

}

export async function deleteCustomer(id:string) {
  
  try {
    await sql`DELETE FROM customers WHERE email = ${id}`;
  } catch (error) {
    return { message: 'Database Error: Failed to delete' };
  }
  revalidatePath('/dashboard/customers');
}


/************ Invoices ***********/
const InvoiceSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce.number()
  .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});
 
const CreateInvoice = InvoiceSchema.omit({ id: true, date: true });
const UpdateInvoice = InvoiceSchema.omit({id: true, date: true});
 
export async function createInvoice(prevState: State, formData: FormData) {
  // for large amounts of form data use 
  // const rawFormData = Object.fromEntries(formData.entries())
  // to gather all data from the form  
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }
  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

     

export async function updateInvoice(id: string, prevState: State, formData:FormData) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  
  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    return { message:  `Database Error: Failed to update ${id}`};
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');

}

export async function deleteInvoice(id:string) {
  
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
  } catch (error) {
    return { message: 'Database Error: Failed to delete' };
  }
  revalidatePath('/dashboard/invoices');
}
/********* Authentication */
export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}