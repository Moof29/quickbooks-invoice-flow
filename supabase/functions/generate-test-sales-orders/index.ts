import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Profile {
  organization_id: string
}

interface Customer {
  id: string
  company_name: string
}

interface Item {
  id: string
  name: string
  purchase_cost: number | null
}

interface CustomerTemplate {
  id: string
}

interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
      }
      customer_profile: {
        Row: Customer
      }
      item_record: {
        Row: Item
      }
      customer_templates: {
        Row: CustomerTemplate
        Insert: {
          organization_id: string
          customer_id: string
          name: string
          description?: string
          is_active?: boolean
        }
      }
      sales_order: {
        Insert: {
          id?: string
          organization_id: string
          customer_id: string
          order_date?: string
          order_number?: string
          status?: string
          subtotal?: number
          total?: number
          memo?: string
        }
      }
      sales_order_line_item: {
        Insert: {
          id?: string
          organization_id: string
          sales_order_id: string
          item_id: string
          quantity: number
          unit_price: number
        }
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Authentication failed')
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('Could not get user profile')
    }

    const organizationId = (profile as Profile).organization_id

    // Get available customers and items
    const { data: customers, error: customersError } = await supabaseClient
      .from('customer_profile')
      .select('id, company_name')
      .eq('organization_id', organizationId)
      .limit(10)

    if (customersError) {
      throw new Error(`Error fetching customers: ${customersError.message}`)
    }

    const { data: items, error: itemsError } = await supabaseClient
      .from('item_record')
      .select('id, name, purchase_cost')
      .eq('organization_id', organizationId)
      .limit(20)

    if (itemsError) {
      throw new Error(`Error fetching items: ${itemsError.message}`)
    }

    const typedCustomers = customers as Customer[] | null
    const typedItems = items as Item[] | null

    if (!typedCustomers || typedCustomers.length === 0) {
      throw new Error('No customers found. Please create some customers first.')
    }

    if (!typedItems || typedItems.length === 0) {
      throw new Error('No items found. Please create some items first.')
    }

    console.log(`Found ${typedCustomers.length} customers and ${typedItems.length} items`)

    // First, create customer templates for all customers if they don't exist
    console.log('Creating customer templates...')
    for (const customer of typedCustomers) {
      // Check if customer already has templates
      const { data: existingTemplates, error: templateCheckError } = await supabaseClient
        .from('customer_templates')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('organization_id', organizationId)

      if (templateCheckError) {
        console.error('Error checking existing templates:', templateCheckError)
        continue
      }

      // Create template if none exists (inactive to avoid auto-generation)
      if (!existingTemplates || existingTemplates.length === 0) {
        const { error: templateError } = await supabaseClient
          .from('customer_templates')
          // @ts-ignore - Supabase type inference issue in edge functions
          .insert({
            organization_id: organizationId,
            customer_id: customer.id,
            name: `Template for ${customer.company_name}`,
            description: 'Auto-generated template for test data',
            is_active: false  // Keep inactive to prevent auto-generation
          })

        if (templateError) {
          console.error(`Error creating template for ${customer.company_name}:`, templateError)
        } else {
          console.log(`Created template for ${customer.company_name}`)
        }
      }
    }
    const salesOrders = []
    const lineItems = []
    const statuses = ['pending_approval', 'pending_approval', 'approved', 'invoiced'] // Use database-valid statuses

    for (let i = 1; i <= 20; i++) {
      const customerId = typedCustomers[Math.floor(Math.random() * typedCustomers.length)].id
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      
      // Generate order date (last 30 days)
      const orderDate = new Date()
      orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 30))
      
      const salesOrderId = crypto.randomUUID()
      
      // Create 1-5 line items per order
      const numLineItems = Math.floor(Math.random() * 5) + 1
      let orderTotal = 0
      
      for (let j = 0; j < numLineItems; j++) {
        const item = typedItems[Math.floor(Math.random() * typedItems.length)]
        const quantity = Math.floor(Math.random() * 10) + 1
        const unitPrice = item.purchase_cost || (Math.random() * 100 + 10)
        const amount = quantity * unitPrice
        
        lineItems.push({
          id: crypto.randomUUID(),
          organization_id: organizationId,
          sales_order_id: salesOrderId,
          item_id: item.id,
          quantity,
          unit_price: unitPrice
        })
        
        orderTotal += amount
      }
      
      salesOrders.push({
        id: salesOrderId,
        organization_id: organizationId,
        customer_id: customerId,
        order_date: orderDate.toISOString().split('T')[0],
        status,
        // Don't set totals - let triggers calculate them after line items
        memo: 'Test sales order ' + i + ' - Generated for testing'
      })
    }

    console.log(`Generated ${salesOrders.length} sales orders with ${lineItems.length} line items`)

    // Insert sales orders in smaller batches to avoid issues
    const batchSize = 5
    for (let i = 0; i < salesOrders.length; i += batchSize) {
      const batch = salesOrders.slice(i, i + batchSize)
      // @ts-ignore - Supabase type inference issue in edge functions
      const { error: ordersError } = await supabaseClient
        .from('sales_order')
        .insert(batch)

      if (ordersError) {
        console.error(`Error inserting sales order batch ${i}:`, ordersError)
        throw new Error(`Error inserting sales orders: ${ordersError.message}`)
      }
    }

    // Insert line items in smaller batches
    for (let i = 0; i < lineItems.length; i += batchSize) {
      const batch = lineItems.slice(i, i + batchSize)
      // @ts-ignore - Supabase type inference issue in edge functions
      const { error: lineItemsError } = await supabaseClient
        .from('sales_order_line_item')
        .insert(batch)

      if (lineItemsError) {
        console.error(`Error inserting line item batch ${i}:`, lineItemsError)
        throw new Error(`Error inserting line items: ${lineItemsError.message}`)
      }
    }

    console.log('Successfully created test sales orders')

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully created ${salesOrders.length} test sales orders`,
        orders: salesOrders.length,
        lineItems: lineItems.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error generating test sales orders:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = (error as any)?.details || (error as any)?.hint || 'No additional details'
    const errorCode = (error as any)?.code || 'No error code'
    
    console.error('Error details:', errorDetails)
    console.error('Error code:', errorCode)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: errorDetails,
        code: errorCode
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})