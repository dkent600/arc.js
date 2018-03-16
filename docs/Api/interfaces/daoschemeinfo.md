[API Reference](../README.md) > [DaoSchemeInfo](../interfaces/DaoSchemeInfo.md)



# Interface: DaoSchemeInfo


Returned from DAO.getSchemes


## Properties
<a id="address"></a>

###  address

**●  address**:  *`string`* 

*Defined in [dao.ts:319](https://github.com/daostack/arc.js/blob/caacbb2/lib/dao.ts#L319)*



Scheme address




___

<a id="name"></a>

### «Optional» name

**●  name**:  *`string`* 

*Defined in [dao.ts:315](https://github.com/daostack/arc.js/blob/caacbb2/lib/dao.ts#L315)*



Arc scheme name. Will be undefined if not an Arc scheme.




___

<a id="permissions"></a>

###  permissions

**●  permissions**:  *[SchemePermissions](../enums/SchemePermissions.md)* 

*Defined in [dao.ts:325](https://github.com/daostack/arc.js/blob/caacbb2/lib/dao.ts#L325)*



The scheme's permissions. See ExtendTruffleContract.getDefaultPermissions for what this string looks like.




___

