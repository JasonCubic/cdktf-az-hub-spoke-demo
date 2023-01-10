import { Construct } from 'constructs';
import { LocalBackend, TerraformStack, TerraformVariable } from 'cdktf';
import { VirtualNetworkPeering } from '@cdktf/provider-azurerm/lib/virtual-network-peering/index.js';
import AzurermOidcProvider from '../../constructs/L1-azurerm-oidc-provider/index.js';

// for dev time type hints (cross-stack typing in the preSynth hook function)
import StackMap from '../../stack-map-type.js';
import HubDemoStack from '../hub-demo/index.js';
import SpokeDemoStack from '../spoke-demo/index.js';

// By the peering being in it's own stack its state gets tracked separately.
class PeerHubDemoAndSpokeDemo extends TerraformStack {
  private hubProvider: AzurermOidcProvider;

  private spokeProvider: AzurermOidcProvider;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    new LocalBackend(this);

    // tenantId and clientId are not secret so can be in a plain json file in the repo
    const tenantId = new TerraformVariable(this, 'tenantId', { type: 'string' }); // process.env.TF_VAR_tenantId
    const hubClientId = new TerraformVariable(this, 'hubClientId', { type: 'string' }); // process.env.TF_VAR_hubClientId
    const spokeClientId = new TerraformVariable(this, 'spokeClientId', { type: 'string' }); // process.env.TF_VAR_clientId

    // subscriptionId is not publicly available but it is tokenized.  Can be in plain text as long as the repo is not public (not available on the internet)
    const hubSubscriptionId = new TerraformVariable(this, 'hubSubscriptionId', { type: 'string' }); // process.env.TF_VAR_hubSubscriptionId
    const spokeSubscriptionId = new TerraformVariable(this, 'spokeSubscriptionId', { type: 'string' }); // process.env.TF_VAR_spokeSubscriptionId

    // clientSecret is a secret and can not appear in the repo
    const hubClientSecret = new TerraformVariable(this, 'hubClientSecret', { type: 'string', sensitive: true }); // process.env.TF_VAR_hubClientSecret
    const spokeClientSecret = new TerraformVariable(this, 'spokeClientSecret', { type: 'string', sensitive: true }); // process.env.TF_VAR_spokeClientSecret

    this.hubProvider = new AzurermOidcProvider(this, 'hub-azure-provider', {
      useOidc: true,
      alias: 'hub-azurerm-provider',
      tenantId: tenantId.stringValue,
      subscriptionId: hubSubscriptionId.stringValue,
      // NOTE: the client used has to have the rights to create VirtualNetworkPeering in both the hub and spoke subscriptions
      clientId: hubClientId.stringValue,
      clientSecret: hubClientSecret.stringValue,
      features: {},
    });

    this.spokeProvider = new AzurermOidcProvider(this, 'spoke-azure-provider', {
      useOidc: true,
      alias: 'spoke-azurerm-provider',
      tenantId: tenantId.stringValue,
      subscriptionId: spokeSubscriptionId.stringValue,
      // NOTE: the client used has to have the rights to create VirtualNetworkPeering in both the hub and spoke subscriptions
      clientId: spokeClientId.stringValue,
      clientSecret: spokeClientSecret.stringValue,
      features: {},
    });
  }

  // the preSynth hook is invoked in src\index.ts
  // runs after all stacks have been instantiated and before the app.synth()
  // the preSynth hook is intended to be the place to set cross-stack dependencies
  preSynth(stacksObj: StackMap) {
    const hub = (stacksObj['hub-demo'] as HubDemoStack);
    const spoke = (stacksObj['spoke-demo'] as SpokeDemoStack);
    const allowVirtualNetworkAccess = true; // default is true
    const allowForwardedTraffic = false; // default is false
    const allowGatewayTransit = false;

    this.addDependency(stacksObj['add-peering-role-to-hub-and-spoke']); // peering fails to create without this being run first

    // https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/virtual_network_peering
    new VirtualNetworkPeering(this, 'peer-hub-vnet-to-spoke-vnet', {
      name: 'peer-hub-vnet-to-spoke-vnet',
      resourceGroupName: hub.simpleHub.hubRg.name,
      virtualNetworkName: hub.simpleHub.simpleHubVNet.vNet.name,
      remoteVirtualNetworkId: spoke.simpleSpoke.simpleSpokeVNet.vNet.id,
      allowVirtualNetworkAccess,
      allowForwardedTraffic,
      allowGatewayTransit,
      provider: this.hubProvider,
    });

    new VirtualNetworkPeering(this, 'peer-spoke-vnet-to-hub-vnet', {
      name: 'peer-spoke-vnet-to-hub-vnet',
      resourceGroupName: spoke.simpleSpoke.spokeRg.name,
      virtualNetworkName: spoke.simpleSpoke.simpleSpokeVNet.vNet.name,
      remoteVirtualNetworkId: hub.simpleHub.simpleHubVNet.vNet.id,
      allowVirtualNetworkAccess,
      allowForwardedTraffic,
      allowGatewayTransit,
      provider: this.spokeProvider,
    });
  }
}

export default PeerHubDemoAndSpokeDemo;
