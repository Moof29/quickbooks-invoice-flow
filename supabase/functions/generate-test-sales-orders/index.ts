import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
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
    const supabaseClient = createClient<Database>(
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

    const organizationId = profile.organization_id

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

    if (!customers || customers.length === 0) {
      throw new Error('No customers found. Please create some customers first.')
    }

    if (!items || items.length === 0) {
      throw new Error('No items found. Please create some items first.')
    }

    console.log(`Found ${customers.length} customers and ${items.length} items`)

    // Generate fake sales orders
    const salesOrders = []
    const lineItems = []
    const statuses = ['pending', 'pending', 'pending', 'approved', 'invoiced'] // More pending orders

    for (let i = 1; i <= 20; i++) {
      const customerId = customers[Math.floor(Math.random() * customers.length)].id
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      
      // Generate order date (last 30 days)
      const orderDate = new Date()
      orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 30))
      
      const salesOrderId = crypto.randomUUID()
      
      // Create 1-5 line items per order
      const numLineItems = Math.floor(Math.random() * 5) + 1
      let orderTotal = 0
      
      for (let j = 0; j < numLineItems; j++) {
        const item = items[Math.floor(Math.random() * items.length)]
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
      
      // Generate order number using the database function
      const { data: orderNumber, error: orderNumberError } = await supabaseClient
        .rpc('generate_sales_order_number', { org_id: organizationId })
      
      if (orderNumberError) {
        console.error('Error generating order number:', orderNumberError)
        // Fallback to manual generation
        const fallbackOrderNumber = `TST-${new Date().getFullYear()}-${String(i).padStart(3, '0')}`
        
        salesOrders.push({
          id: salesOrderId,
          organization_id: organizationId,
          customer_id: customerId,
          order_date: orderDate.toISOString().split('T')[0],
          order_number: fallbackOrderNumber,
          status,
          subtotal: Math.round(orderTotal * 100) / 100,
          total: Math.round(orderTotal * 100) / 100,
          memo: `Test sales order #${i} - Generated for testing purposes`
        })
      } else {
        salesOrders.push({
          id: salesOrderId,
          organization_id: organizationId,
          customer_id: customerId,
          order_date: orderDate.toISOString().split('T')[0],
          order_number: orderNumber,
          status,
          subtotal: Math.round(orderTotal * 100) / 100,
          total: Math.round(orderTotal * 100) / 100,
          memo: `Test sales order #${i} - Generated for testing purposes`
        })
      }
    }

    console.log(`Generated ${salesOrders.length} sales orders with ${lineItems.length} line items`)

    // Insert sales orders
    const { error: ordersError } = await supabaseClient
      .from('sales_order')
      .insert(salesOrders)

    if (ordersError) {
      throw new Error(`Error inserting sales orders: ${ordersError.message}`)
    }

    // Insert line items
    const { error: lineItemsError } = await supabaseClient
      .from('sales_order_line_item')
      .insert(lineItems)

    if (lineItemsError) {
      throw new Error(`Error inserting line items: ${lineItemsError.message}`)
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
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})