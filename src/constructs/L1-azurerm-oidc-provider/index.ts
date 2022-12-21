import { Construct } from 'constructs';
import { AzurermProvider, AzurermProviderConfig } from '@cdktf/provider-azurerm/lib/provider/index.js';

// this modifies the AzurermProviderConfig type to require that OIDC be set to true
interface AzurermOidcProviderConfig extends AzurermProviderConfig { useOidc: true }

class AzurermOidcProvider extends AzurermProvider {
  constructor(scope: Construct, name: string, options: AzurermOidcProviderConfig) {
    super(scope, name, (options as AzurermProviderConfig));
  }
}

export default AzurermOidcProvider;
